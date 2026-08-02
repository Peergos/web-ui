using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.Net;
using System.Runtime.InteropServices;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

[STAThread]
static class Program
{
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
            await webView.EnsureCoreWebView2Async();
            webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
            webView.CoreWebView2.Settings.IsStatusBarEnabled = false;
            webView.CoreWebView2.Navigate("http://localhost:" + port);
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

    private void HideTray()
    {
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
                request.Timeout = 5_000;
                request.ReadWriteTimeout = 5_000;
                using (var response = request.GetResponse())
                using (var reader = new StreamReader(response.GetResponseStream()))
                {
                    var json = (Dictionary<string, object>) new JavaScriptSerializer().DeserializeObject(reader.ReadToEnd());
                    object value;
                    state = json.TryGetValue("state", out value) && value != null ? value.ToString() : "NONE";
                    msg = json.TryGetValue("msg", out value) && value != null ? value.ToString() : "";
                    if (json.TryGetValue("error", out value) && value != null && value.ToString().Length > 0)
                        msg = value.ToString();
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
        return s.Length <= max ? s : s.Substring(0, max - 1) + "…";
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

    // Not disposed: the fallback is a shared static that must outlive us, and this is
    // called a handful of times at most.
    private static Icon AppIcon()
    {
        return Icon.ExtractAssociatedIcon(Application.ExecutablePath) ?? SystemIcons.Application;
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
                try { return (Icon) Icon.FromHandle(handle).Clone(); }
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
