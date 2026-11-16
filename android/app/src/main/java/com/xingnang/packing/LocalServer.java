package com.xingnang.packing;

import android.content.res.AssetManager;

import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Serves the bundled 第二问 web app from a fixed loopback origin.
 * localhost is a secure context, so WebCrypto and IndexedDB work without
 * exposing the app on the LAN.
 */
final class LocalServer {
    static final int PORT = 8788;
    private static final String PREFIX = "second-question";

    private final AssetManager assets;
    private final ExecutorService pool = Executors.newFixedThreadPool(4);
    private volatile boolean running = true;
    private ServerSocket socket;

    LocalServer(AssetManager assets) {
        this.assets = assets;
    }

    void start() throws IOException {
        socket = new ServerSocket(PORT, 16, InetAddress.getByName("127.0.0.1"));
        Thread thread = new Thread(new Runnable() {
            @Override
            public void run() {
                while (running) {
                    try {
                        Socket client = socket.accept();
                        pool.execute(new Handler(client));
                    } catch (IOException error) {
                        if (running) error.printStackTrace();
                    }
                }
            }
        });
        thread.setDaemon(true);
        thread.start();
    }

    int getPort() {
        return socket.getLocalPort();
    }

    void stop() {
        running = false;
        try {
            if (socket != null) socket.close();
        } catch (IOException ignored) {
        }
        pool.shutdownNow();
    }

    private final class Handler implements Runnable {
        private final Socket client;

        Handler(Socket client) {
            this.client = client;
        }

        @Override
        public void run() {
            try (Socket socket = client) {
                BufferedReader in = new BufferedReader(
                    new InputStreamReader(socket.getInputStream(), StandardCharsets.UTF_8)
                );
                String requestLine = in.readLine();
                if (requestLine == null) return;
                String line;
                while ((line = in.readLine()) != null && !line.isEmpty()) {
                    // Skip request headers.
                }

                String[] parts = requestLine.split(" ");
                String method = parts.length > 0 ? parts[0] : "GET";
                String path = parts.length > 1 ? parts[1] : "/";
                int query = path.indexOf('?');
                if (query >= 0) path = path.substring(0, query);
                if (path.endsWith("/")) path += "index.html";
                String asset = path.startsWith("/") ? path.substring(1) : path;
                String lookup = PREFIX + "/" + asset;

                OutputStream out = socket.getOutputStream();
                try (InputStream input = assets.open(lookup)) {
                    byte[] body = readAll(input);
                    byte[] head = buildHead(200, "OK", mimeOf(asset), body.length);
                    out.write(head);
                    if (!"HEAD".equals(method)) out.write(body);
                } catch (IOException missing) {
                    byte[] body = "not found".getBytes(StandardCharsets.UTF_8);
                    byte[] head = buildHead(404, "Not Found", "text/plain; charset=utf-8", body.length);
                    out.write(head);
                    if (!"HEAD".equals(method)) out.write(body);
                }
                out.flush();
            } catch (IOException ignored) {
            }
        }
    }

    private static byte[] buildHead(int code, String reason, String mime, int length)
        throws IOException {
        String head = "HTTP/1.1 " + code + " " + reason + "\r\n"
            + "Content-Type: " + mime + "\r\n"
            + "Content-Length: " + length + "\r\n"
            + "Cache-Control: no-cache\r\n"
            + "Connection: close\r\n\r\n";
        return head.getBytes(StandardCharsets.UTF_8);
    }

    private static byte[] readAll(InputStream input) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        int read;
        while ((read = input.read(buffer)) > 0) {
            out.write(buffer, 0, read);
        }
        return out.toByteArray();
    }

    private static String mimeOf(String path) {
        String value = path.toLowerCase();
        if (value.endsWith(".html")) return "text/html; charset=utf-8";
        if (value.endsWith(".js") || value.endsWith(".mjs")) return "text/javascript; charset=utf-8";
        if (value.endsWith(".css")) return "text/css; charset=utf-8";
        if (value.endsWith(".json")) return "application/json; charset=utf-8";
        if (value.endsWith(".webmanifest")) return "application/manifest+json; charset=utf-8";
        if (value.endsWith(".png")) return "image/png";
        if (value.endsWith(".svg")) return "image/svg+xml";
        return "application/octet-stream";
    }
}
