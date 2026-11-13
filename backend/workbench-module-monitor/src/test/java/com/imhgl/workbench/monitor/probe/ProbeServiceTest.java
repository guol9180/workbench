package com.imhgl.workbench.monitor.probe;

import com.imhgl.workbench.infrastructure.metrics.TrafficRecord;
import com.imhgl.workbench.monitor.collector.ProbeTarget;
import com.imhgl.workbench.monitor.collector.SourceConfigProperties;
import com.imhgl.workbench.monitor.collector.SourceConfigStore;
import com.imhgl.workbench.monitor.service.MonitorService;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.ArgumentCaptor;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

/** 拨测执行：状态映射、超时/连接失败记 0、启用开关与单目标失败隔离 */
class ProbeServiceTest {

    @TempDir
    Path temp;

    private HttpServer server;

    private SourceConfigStore store() {
        return new SourceConfigStore(
                new SourceConfigProperties(temp.resolve("sources.json").toString(), "", "-"));
    }

    private ProbeService service(SourceConfigStore store, MonitorService monitor, int timeoutMs) {
        return new ProbeService(store, monitor, new ProbeProperties(true, 60, timeoutMs));
    }

    private void startServer() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/ok", exchange -> {
            exchange.sendResponseHeaders(200, -1);
            exchange.close();
        });
        server.createContext("/fail", exchange -> {
            exchange.sendResponseHeaders(500, -1);
            exchange.close();
        });
        server.createContext("/slow", exchange -> {
            try {
                Thread.sleep(500);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
            exchange.sendResponseHeaders(200, -1);
            exchange.close();
        });
        server.start();
    }

    private String url(String path) {
        return "http://127.0.0.1:" + server.getAddress().getPort() + path;
    }

    @AfterEach
    void stopServer() {
        if (server != null) {
            server.stop(0);
        }
    }

    @Test
    @DisplayName("200 / 500 状态与延迟写入合成流量记录（source=probe/{name}，endpoint=url）")
    void recordsStatusAndLatency() throws IOException {
        startServer();
        MonitorService monitor = mock(MonitorService.class);
        ProbeService probeService = service(store(), monitor, 1000);

        probeService.probe(new ProbeTarget("probe-1", "demo", url("/ok"), true, 0));
        probeService.probe(new ProbeTarget("probe-2", "failing", url("/fail"), true, 0));

        ArgumentCaptor<TrafficRecord> captor = ArgumentCaptor.forClass(TrafficRecord.class);
        verify(monitor, times(2)).record(captor.capture());
        TrafficRecord ok = captor.getAllValues().get(0);
        assertEquals("probe/demo", ok.source());
        assertEquals(url("/ok"), ok.endpoint());
        assertEquals("GET", ok.method());
        assertEquals(200, ok.status());
        assertEquals(1, ok.count());
        assertEquals(1, ok.latencySamples().size());
        assertEquals(500, captor.getAllValues().get(1).status());
    }

    @Test
    @DisplayName("超时与连接失败都记 status=0")
    void timeoutAndConnectionFailureRecordZero() throws IOException, InterruptedException {
        startServer();
        MonitorService monitor = mock(MonitorService.class);
        ProbeService probeService = service(store(), monitor, 100);

        probeService.probe(new ProbeTarget("probe-1", "slow", url("/slow"), true, 0));
        String stoppedUrl = url("/ok");
        server.stop(0);
        server = null;
        probeService.probe(new ProbeTarget("probe-2", "down", stoppedUrl, true, 0));

        ArgumentCaptor<TrafficRecord> captor = ArgumentCaptor.forClass(TrafficRecord.class);
        verify(monitor, times(2)).record(captor.capture());
        assertEquals(0, captor.getAllValues().get(0).status());
        assertEquals(0, captor.getAllValues().get(1).status());
    }

    @Test
    @DisplayName("probeAll 只探测启用目标，单目标失败不影响后续")
    void probeAllSkipsDisabledAndIsolatesFailures() throws IOException {
        startServer();
        SourceConfigStore store = store();
        store.createProbe("ok", url("/ok"), true);
        store.createProbe("off", url("/ok") + "?off=1", false);
        store.createProbe("down", "http://127.0.0.1:1/", true);

        MonitorService monitor = mock(MonitorService.class);
        int probed = service(store, monitor, 200).probeAll();

        assertEquals(2, probed);
        verify(monitor, times(2)).record(any(TrafficRecord.class));
        assertEquals(List.of("ok", "off", "down"),
                store.probes().stream().map(ProbeTarget::name).toList());
    }
}
