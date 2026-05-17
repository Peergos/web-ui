using System;
using System.Drawing;
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
    public PeergosWindow(string port)
    {
        Text = "Peergos";
        ClientSize = new Size(1280, 900);
        StartPosition = FormStartPosition.CenterScreen;

        var webView = new WebView2 { Dock = DockStyle.Fill };
        Controls.Add(webView);

        Load += async (_, __) =>
        {
            await webView.EnsureCoreWebView2Async();
            webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
            webView.CoreWebView2.Settings.IsStatusBarEnabled = false;
            webView.CoreWebView2.Navigate("http://localhost:" + port);
        };
    }
}
