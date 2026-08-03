using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.Net;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

static class Program
{
    // WinForms and WebView2 both need a single threaded apartment. This belongs on
    // Main: on the class it is a compile error, not a no-op.
    [STAThread]
    static void Main()
    {
        // Check WebView2 availability before showing any UI.
        // Exit code 1 tells the Java launcher to fall back to Edge.
        try { CoreWebView2Environment.GetAvailableBrowserVersionString(); }
        catch { Environment.Exit(1); return; }

        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        string port = Environment.GetEnvironmentVariable("PEERGOS_PORT") ?? "7777";
        Application.Run(new PeergosWindow(port));
    }
}

class PeergosWindow : Form
{
    // NotifyIcon.Text is limited to 63 characters and throws above that.
    private const int MAX_TOOLTIP = 63;
    private const int POLL_INTERVAL_MS = 10_000;

    private readonly string port;
    private readonly NotifyIcon tray;
    private readonly ToolStripMenuItem statusItem;
    private readonly System.Windows.Forms.Timer statusTimer;
    private readonly Dictionary<string, Icon> icons = new Dictionary<string, Icon>();
    // Closing the window hides it to the tray; only "Close Peergos" really quits.
    private bool quitting;
    private bool trayHidden;
    private string currentState = "";

    public PeergosWindow(string port)
    {
        this.port = port;
        Text = "Peergos";
        ClientSize = new Size(1280, 900);
        StartPosition = FormStartPosition.CenterScreen;
        // the taskbar, Alt+Tab and title bar icon. WinForms uses its own default
        // otherwise - ApplicationIcon only covers the .exe in Explorer.
        Icon = AppIcon();

        var webView = new WebView2 { Dock = DockStyle.Fill };
        Controls.Add(webView);

        Load += async (_, __) =>
        {
            try
            {
                var environment = await CoreWebView2Environment.CreateAsync(null, UserDataFolder(), null);
                await webView.EnsureCoreWebView2Async(environment);
                webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
                webView.CoreWebView2.Settings.IsStatusBarEnabled = false;
                webView.CoreWebView2.NewWindowRequested += OnNewWindowRequested;
                webView.CoreWebView2.Navigate("http://localhost:" + port);
            }
            catch (Exception e)
            {
                // Exit 1 so the launcher falls back to Edge, rather than leaving
                // the user with a crash dialog and a dead window.
                Console.Error.WriteLine("WebView2 failed to start: " + e.Message);
                HideTray();
                Environment.Exit(1);
            }
        };

        statusItem = new ToolStripMenuItem("Peergos") { Enabled = false };
        var closeItem = new ToolStripMenuItem("Close Peergos");
        closeItem.Click += (_, __) => Quit();
        var menu = new ContextMenuStrip();
        menu.Items.Add(statusItem);
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add(closeItem);

        tray = new NotifyIcon
        {
            Icon = IconFor("NONE"),
            Text = "Peergos",
            ContextMenuStrip = menu,
            Visible = true
        };
        // With minimise to tray this is the main way back into the app.
        tray.MouseClick += (_, e) => { if (e.Button == MouseButtons.Left) ShowWindow(); };

        FormClosing += (_, e) =>
        {
            if (quitting || e.CloseReason == CloseReason.WindowsShutDown || e.CloseReason == CloseReason.TaskManagerClosing)
                return;
            // Keep the WebView2 instance alive so reopening is instant and keeps page state.
            e.Cancel = true;
            Hide();
        };
        // Without this the icon lingers in the notification area until hovered.
        Application.ApplicationExit += (_, __) => HideTray();

        statusTimer = new System.Windows.Forms.Timer { Interval = POLL_INTERVAL_MS };
        statusTimer.Tick += (_, __) => PollStatus();
        statusTimer.Start();
        PollStatus();
    }

    // target=_blank links: send them to the user's browser rather than a second,
    // chromeless WebView2 window with no way back.
    private static void OnNewWindowRequested(object sender, CoreWebView2NewWindowRequestedEventArgs e)
    {
        e.Handled = true;
        Uri uri;
        if (! Uri.TryCreate(e.Uri, UriKind.Absolute, out uri))
            return;
        if (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps)
            return;
        try
        {
            Process.Start(new ProcessStartInfo(uri.AbsoluteUri) { UseShellExecute = true });
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine("Could not open " + uri + ": " + ex.Message);
        }
    }

    // WebView2 defaults this to the directory holding the .exe, which under
    // C:\Program Files is not writable - CreateAsync then fails with E_ACCESSDENIED.
    private static string UserDataFolder()
    {
        string folder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                                     "Peergos", "WebView2");
        Directory.CreateDirectory(folder);
        return folder;
    }

    private void ShowWindow()
    {
        Show();
        if (WindowState == FormWindowState.Minimized)
            WindowState = FormWindowState.Normal;
        Activate();
        BringToFront();
    }

    private void Quit()
    {
        quitting = true;
        statusTimer.Stop();
        HideTray();
        // Exit code 0 tells the server to shut down.
        Application.Exit();
    }

    // Called from Quit, from the WebView2 failure path, and again on ApplicationExit.
    // Touching a disposed NotifyIcon throws, which would be another crash dialog.
    private void HideTray()
    {
        if (trayHidden)
            return;
        trayHidden = true;
        tray.Visible = false;
        tray.Dispose();
    }

    private void PollStatus()
    {
        ThreadPool.QueueUserWorkItem(_ =>
        {
            // An unreachable or failed poll is red: the server should be there and isn't.
            string state = "ERROR";
            string msg = "Cannot reach Peergos";
            try
            {
                var request = (HttpWebRequest) WebRequest.Create("http://localhost:" + port + "/peergos/v0/sync/status");
                // the localhost API only answers POST - a GET is a 405
                request.Method = "POST";
                request.ContentLength = 0;
                request.Timeout = 5_000;
                request.ReadWriteTimeout = 5_000;
                using (request.GetRequestStream()) { }
                using (var response = request.GetResponse())
                using (var reader = new StreamReader(response.GetResponseStream()))
                {
                    Dictionary<string, string> json = ParseTopLevelStrings(reader.ReadToEnd());
                    string value;
                    state = json.TryGetValue("state", out value) && value.Length > 0 ? value : "NONE";
                    msg = json.TryGetValue("msg", out value) ? value : "";
                    if (json.TryGetValue("error", out value) && value.Length > 0)
                        msg = value;
                }
            }
            catch { }
            try { BeginInvoke((Action) (() => ApplyStatus(state, msg))); }
            catch (InvalidOperationException) { } // window gone, we are shutting down
        });
    }

    private void ApplyStatus(string state, string msg)
    {
        if (state != currentState)
        {
            currentState = state;
            // Adding the first sync pair makes the dot appear, removing the last makes it vanish.
            tray.Icon = IconFor(state);
        }
        string line = string.IsNullOrEmpty(msg) ? "Peergos" : msg;
        statusItem.Text = line;
        tray.Text = Truncate(line, MAX_TOOLTIP);
    }

    private static string Truncate(string s, int max)
    {
        return s.Length <= max ? s : s.Substring(0, max - 3) + "...";
    }

    // Just the top level string fields of the status reply, so that reading three
    // strings doesn't cost a framework reference. Nested objects are skipped, so a
    // pair's "state" can't be mistaken for the global one.
    private static Dictionary<string, string> ParseTopLevelStrings(string json)
    {
        var fields = new Dictionary<string, string>();
        string key = null;
        int depth = 0;
        for (int i = 0; i < json.Length; i++)
        {
            char c = json[i];
            if (c == '{' || c == '[')
                depth++;
            else if (c == '}' || c == ']')
            {
                depth--;
                key = null;
            }
            else if (c == '"')
            {
                // always consume the whole string, so braces inside one don't count
                string text = ReadString(json, ref i);
                if (depth != 1)
                    continue;
                int next = i + 1;
                while (next < json.Length && char.IsWhiteSpace(json[next]))
                    next++;
                if (next < json.Length && json[next] == ':')
                    key = text;
                else if (key != null)
                {
                    fields[key] = text;
                    key = null;
                }
            }
        }
        return fields;
    }

    // Reads the string starting at the quote json[i], leaving i on the closing quote.
    private static string ReadString(string json, ref int i)
    {
        var text = new StringBuilder();
        for (i++; i < json.Length && json[i] != '"'; i++)
        {
            if (json[i] != '\\' || i + 1 >= json.Length)
            {
                text.Append(json[i]);
                continue;
            }
            switch (json[++i])
            {
                case 'n': text.Append('\n'); break;
                case 't': text.Append('\t'); break;
                case 'r': text.Append('\r'); break;
                case 'b': text.Append('\b'); break;
                case 'f': text.Append('\f'); break;
                case 'u':
                    if (i + 4 < json.Length)
                    {
                        text.Append((char) Convert.ToInt32(json.Substring(i + 1, 4), 16));
                        i += 4;
                    }
                    break;
                default: text.Append(json[i]); break; // \" \\ \/
            }
        }
        return text.ToString();
    }

    private Icon IconFor(string state)
    {
        Icon cached;
        if (! icons.TryGetValue(state, out cached))
        {
            cached = BuildIcon(state);
            icons[state] = cached;
        }
        return cached;
    }

    // Fully qualified: Form.Icon is an inherited instance property of the same name,
    // and these are static methods.
    // Not disposed: the fallback is a shared static that must outlive us, and this is
    // called a handful of times at most.
    private static Icon AppIcon()
    {
        return System.Drawing.Icon.ExtractAssociatedIcon(Application.ExecutablePath) ?? SystemIcons.Application;
    }

    // The status dot is a badge on the constant Peergos icon, so the icon is always present -
    // with no sync pairs it is just the plain icon. Removing it would leave the server running
    // with no way to reopen or quit it.
    private static Icon BuildIcon(string state)
    {
        Size size = SystemInformation.SmallIconSize;
        using (var scaled = new Icon(AppIcon(), size))
        {
            Color dot;
            if (! DotColour(state, out dot))
                return (Icon) scaled.Clone();

            using (var bitmap = new Bitmap(size.Width, size.Height))
            using (var g = Graphics.FromImage(bitmap))
            {
                g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                g.SmoothingMode = SmoothingMode.AntiAlias;
                g.DrawIcon(scaled, new Rectangle(0, 0, size.Width, size.Height));

                int diameter = Math.Max(6, size.Width / 2);
                var box = new Rectangle(size.Width - diameter, size.Height - diameter, diameter - 1, diameter - 1);
                using (var fill = new SolidBrush(dot))
                using (var outline = new Pen(Color.White))
                {
                    g.FillEllipse(fill, box);
                    g.DrawEllipse(outline, box);
                }

                IntPtr handle = bitmap.GetHicon();
                try { return (Icon) System.Drawing.Icon.FromHandle(handle).Clone(); }
                finally { DestroyIcon(handle); }
            }
        }
    }

    private static bool DotColour(string state, out Color colour)
    {
        switch (state)
        {
            case "SYNCED":  colour = Color.FromArgb(46, 160, 67);  return true;
            case "SYNCING": colour = Color.FromArgb(219, 138, 15); return true;
            case "ERROR":   colour = Color.FromArgb(218, 54, 51);  return true;
            default:        colour = Color.Empty;                  return false; // NONE: nothing to report
        }
    }

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool DestroyIcon(IntPtr handle);
}
