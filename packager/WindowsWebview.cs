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
using Microsoft.Win32;
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
        // Set by the server when it was started with -minimised true, which is what the
        // login item written by "Start on boot" does: come up as a tray icon, no window.
        bool minimised = ! string.IsNullOrEmpty(Environment.GetEnvironmentVariable("PEERGOS_MINIMISED"));
        Application.Run(new PeergosWindow(port, minimised));
    }
}

class PeergosWindow : Form
{
    // NotifyIcon.Text is limited to 63 characters and throws above that.
    private const int MAX_TOOLTIP = 63;
    private const int POLL_INTERVAL_MS = 10_000;

    // HKCU, so no elevation and no effect on other users of a machine-wide install.
    // Written by the app rather than the installer, so the toggle is the only thing
    // that ever touches it. An uninstall therefore leaves it: MSI can only remove a
    // value it created itself, so the entry stays, naming an .exe that has gone,
    // which Windows skips silently at login.
    private const string RUN_KEY = @"Software\Microsoft\Windows\CurrentVersion\Run";
    // Task Manager's Startup tab disables an entry by writing here rather than by
    // deleting it from Run, so the Run key alone does not answer "is this on?".
    private const string APPROVED_KEY = @"Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run";
    private const string RUN_VALUE = "Peergos";
    // jpackage -n peergos-app, so <install>\peergos-app.exe next to the app directory
    // this .exe lives in. Not our own ExecutablePath: that is the webview host, which
    // on its own would open a window onto a server nobody started.
    private const string LAUNCHER = "peergos-app.exe";

    private readonly string port;
    private readonly WebView2 webView;
    private readonly NotifyIcon tray;
    private readonly ToolStripMenuItem statusItem;
    private readonly ToolStripMenuItem autostartItem;
    private readonly System.Windows.Forms.Timer statusTimer;
    private readonly Dictionary<string, Icon> icons = new Dictionary<string, Icon>();
    // Closing the window hides it to the tray; only "Close Peergos" really quits.
    private bool quitting;
    private bool trayHidden;
    private bool webViewStarted;
    // The server has our window handle, for the webauthn prompt to be modal to.
    private bool windowHandlePosted;
    // Swallows the one show Application.Run does, so a minimised start never draws a window.
    private bool startHidden;
    private string currentState = "";

    public PeergosWindow(string port, bool minimised)
    {
        this.port = port;
        // A window that never appears is only safe because the tray icon below always
        // does - it is created here, whether or not the form is ever shown.
        startHidden = minimised;
        Text = "Peergos";
        ClientSize = new Size(1280, 900);
        StartPosition = FormStartPosition.CenterScreen;
        // the taskbar, Alt+Tab and title bar icon. WinForms uses its own default
        // otherwise - ApplicationIcon only covers the .exe in Explorer.
        Icon = AppIcon();

        webView = new WebView2 { Dock = DockStyle.Fill };
        Controls.Add(webView);
        // Load only fires when the window is shown, and a minimised start may never
        // show it, so SetVisibleCore starts the browser in that case instead.
        Load += (_, __) => StartWebView();

        statusItem = new ToolStripMenuItem("Peergos") { Enabled = false };
        var closeItem = new ToolStripMenuItem("Close Peergos");
        closeItem.Click += (_, __) => Quit();
        var menu = new ContextMenuStrip();
        menu.Items.Add(statusItem);
        menu.Items.Add(new ToolStripSeparator());
        if (LauncherPath() != null)
        {
            // CheckOnClick would tick the box whether or not the login item was
            // written, so the check is taken from the registry instead, both when
            // the menu opens and after a click.
            autostartItem = new ToolStripMenuItem("Start on boot") { CheckOnClick = false };
            autostartItem.Click += (_, __) => ToggleAutostart();
            menu.Items.Add(autostartItem);
        }
        menu.Items.Add(closeItem);
        // The user may have turned the login item off in Task Manager's Startup tab,
        // so read it back every time rather than trusting what we last wrote.
        menu.Opening += (_, __) => RefreshAutostart();

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

    // Application.Run shows the main form once, before anything of ours can hide it
    // again. Swallowing that first show is what keeps a minimised start from drawing
    // a window at all: hiding it from Load instead flashes one up on a slow login.
    protected override void SetVisibleCore(bool visible)
    {
        if (startHidden)
        {
            startHidden = false;
            // With no window at all there is nothing for the message loop to pump and
            // Application.Run returns immediately, taking the tray icon with it.
            if (! IsHandleCreated)
                CreateHandle();
            StartWebView();
            visible = false;
        }
        base.SetVisibleCore(visible);
    }

    // Idempotent: whichever of Load and a hidden start comes first wins.
    private async void StartWebView()
    {
        if (webViewStarted)
            return;
        webViewStarted = true;
        try
        {
            var environment = await CoreWebView2Environment.CreateAsync(null, UserDataFolder(), null);
            await webView.EnsureCoreWebView2Async(environment);
            webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
            webView.CoreWebView2.Settings.IsStatusBarEnabled = false;
            webView.CoreWebView2.NewWindowRequested += OnNewWindowRequested;
            // The top frame and every iframe, nested ones included: both raise the same
            // args, so one handler covers the lot.
            webView.CoreWebView2.NavigationStarting += OnNavigationStarting;
            webView.CoreWebView2.FrameNavigationStarting += OnNavigationStarting;
            // Read by assets/js/webauthn.js, which then routes security keys through the
            // local server. WebView2 has WebAuthn of its own, and that is precisely the
            // problem: from a localhost page it can only ever mint credentials for rpId
            // localhost, so a key registered in a browser for peergos.net could never be
            // offered here. A browser at the same address never sees this set, and is
            // left alone. Before Navigate, or the first page misses it.
            await webView.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(
                "window.__peergosDesktop = true;");
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
    }

    // <install>\peergos-app.exe, the launcher that starts the server and then us.
    // Null if it isn't there - an unpackaged run, say - in which case there is no
    // login item worth writing and the menu leaves the toggle out.
    private static string LauncherPath()
    {
        try
        {
            string appDir = Path.GetDirectoryName(Application.ExecutablePath);
            string installDir = Path.GetDirectoryName(appDir);
            if (installDir == null)
                return null;
            string launcher = Path.Combine(installDir, LAUNCHER);
            return File.Exists(launcher) ? launcher : null;
        }
        catch (Exception e)
        {
            Console.Error.WriteLine("Could not locate the launcher: " + e.Message);
            return null;
        }
    }

    // Whether we are started at login, read from the registry every time it is asked.
    private static bool AutostartEnabled()
    {
        try
        {
            using (RegistryKey run = Registry.CurrentUser.OpenSubKey(RUN_KEY))
            {
                if (run == null || run.GetValue(RUN_VALUE) == null)
                    return false;
            }
            using (RegistryKey approved = Registry.CurrentUser.OpenSubKey(APPROVED_KEY))
            {
                var flags = approved == null ? null : approved.GetValue(RUN_VALUE) as byte[];
                // An odd first byte is Explorer's "the user turned this off"; no entry
                // at all means it was never touched, which counts as on.
                return flags == null || flags.Length == 0 || (flags[0] & 1) == 0;
            }
        }
        catch (Exception e)
        {
            Console.Error.WriteLine("Could not read the Run key: " + e.Message);
            return false;
        }
    }

    private static void SetAutostart(bool enabled)
    {
        string launcher = LauncherPath();
        if (launcher == null)
            return;
        try
        {
            using (RegistryKey run = Registry.CurrentUser.CreateSubKey(RUN_KEY))
            {
                if (enabled)
                    run.SetValue(RUN_VALUE, "\"" + launcher + "\" -minimised true");
                else
                    run.DeleteValue(RUN_VALUE, false);
            }
            if (! enabled)
                return;
            // Turning it back on has to clear a disable done in Task Manager too,
            // otherwise the value is there and Windows still ignores it.
            using (RegistryKey approved = Registry.CurrentUser.OpenSubKey(APPROVED_KEY, true))
            {
                if (approved != null)
                    approved.DeleteValue(RUN_VALUE, false);
            }
        }
        catch (Exception e)
        {
            Console.Error.WriteLine("Could not update the Run key: " + e.Message);
        }
    }

    private void ToggleAutostart()
    {
        SetAutostart(! AutostartEnabled());
        // Read back rather than assume: a write that failed leaves the check where it
        // was, instead of reporting a state we did not reach.
        RefreshAutostart();
    }

    private void RefreshAutostart()
    {
        if (autostartItem != null)
            autostartItem.Checked = AutostartEnabled();
    }

    // The window is the local server's and nothing else. Sandboxed apps are served
    // from a subdomain of it - <app>.localhost:port - so they count too, but a link
    // out of one, example.com in a markdown or html viewer, does not. The schemes the
    // page addresses itself with are never the desktop's: a download rides on a blob:
    // navigation, and cancelling that would take downloads with it.
    private bool IsOurs(string url)
    {
        Uri uri;
        if (! Uri.TryCreate(url, UriKind.Absolute, out uri))
            return true;   // nothing we can judge, so nothing we should redirect
        if (uri.Scheme == "blob" || uri.Scheme == "data" || uri.Scheme == "about")
            return true;
        if (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps)
            return false;
        return (uri.Host == "localhost" || uri.Host.EndsWith(".localhost"))
            && uri.Port.ToString() == port;
    }

    // A link that navigates in place rather than asking for a window: example.com
    // clicked in a viewer app's frame, or mailto: from the share dialog and the
    // calendar. Nothing else in the host sees these - NewWindowRequested is only for
    // target=_blank - so without this an address elsewhere on the web replaces the
    // app, in a window with no back button to return by.
    //
    // Only the web and mail reach the shell. A viewer app frame is rendering someone
    // else's document, and handing whatever scheme it names to ShellExecute is how a
    // file you were sent gets to run something. The rest are simply refused.
    private void OnNavigationStarting(object sender, CoreWebView2NavigationStartingEventArgs e)
    {
        if (IsOurs(e.Uri))
            return;
        e.Cancel = true;
        Uri uri;
        if (! Uri.TryCreate(e.Uri, UriKind.Absolute, out uri))
            return;
        if (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps
            && uri.Scheme != Uri.UriSchemeMailto)
            return;
        Launch(uri);
    }

    private static void Launch(Uri uri)
    {
        try
        {
            Process.Start(new ProcessStartInfo(uri.AbsoluteUri) { UseShellExecute = true });
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine("Could not open " + uri + ": " + ex.Message);
        }
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
        // Handle is only legible from the ui thread, and only once there is one: a
        // minimised start creates it before any window is shown, and until then there is
        // nothing to be modal to anyway, so we let the next poll carry it.
        long window = IsHandleCreated && ! windowHandlePosted ? (long) Handle : 0;
        ThreadPool.QueueUserWorkItem(_ =>
        {
            if (window != 0)
                PostWindowHandle(window);
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

    // webauthn.dll parents its prompt to a window, and the java server has none: it is a
    // different process, and headless. Ours is the only window there is, so the server is
    // told about it. Without a handle the prompt can come up behind the app, which looks
    // exactly like a hang.
    //
    // Sent from the status poll rather than once at startup so it survives the server not
    // being up yet, and comes back after a server restart. The flag is written here on a
    // pool thread and read on the ui thread; the worst a lost write costs is one more post.
    private void PostWindowHandle(long window)
    {
        try
        {
            var request = (HttpWebRequest) WebRequest.Create("http://localhost:" + port + "/peergos/v0/webauthn/host");
            request.Method = "POST";
            request.ContentType = "application/json";
            request.Timeout = 5_000;
            request.ReadWriteTimeout = 5_000;
            byte[] body = Encoding.UTF8.GetBytes("{\"window\":" + window + "}");
            request.ContentLength = body.Length;
            using (var stream = request.GetRequestStream())
                stream.Write(body, 0, body.Length);
            using (request.GetResponse()) { }
            windowHandlePosted = true;
        }
        catch { } // the next poll tries again
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
