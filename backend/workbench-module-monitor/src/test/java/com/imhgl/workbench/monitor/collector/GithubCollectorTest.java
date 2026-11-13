package com.imhgl.workbench.monitor.collector;

import com.imhgl.workbench.monitor.dto.IngestRequest;
import com.imhgl.workbench.monitor.service.MonitorService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.ArgumentCaptor;

import java.nio.file.Path;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** 采集编排：pages/downloads 走增量入库，仓库快照走覆盖写（4 个绝对值） */
class GithubCollectorTest {

    @TempDir
    Path temp;

    @Test
    @DisplayName("采集：traffic 两点入库 + 快照四指标覆盖写")
    void collectsTrafficAndSnapshots() throws Exception {
        SourceConfigStore store = new SourceConfigStore(
                new SourceConfigProperties(temp.resolve("sources.json").toString(), "", "-"));
        SourceConfig config = store.create("github", "owner/repo", true,
                List.of("pages", "downloads"));

        GithubClient client = mock(GithubClient.class);
        long dayMs = 1_760_000_000_000L;
        when(client.views("owner/repo")).thenReturn(List.of(new GithubClient.DailyCount(dayMs, 7)));
        when(client.downloadsTotal("owner/repo")).thenReturn(100L);
        when(client.repoSnapshot("owner/repo"))
                .thenReturn(new GithubClient.RepoSnapshot(12, 3, 2, 1));

        MonitorService service = mock(MonitorService.class);
        GithubTokenProvider tokenProvider = mock(GithubTokenProvider.class);
        when(tokenProvider.hasToken()).thenReturn(true);

        GithubCollector collector = new GithubCollector(store, client, service, tokenProvider);
        assertTrue(collector.collectNow(config.id()).ok());

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<IngestRequest.Point>> pointsCaptor = ArgumentCaptor.forClass(List.class);
        verify(service).ingest(eq("github/owner/repo"), pointsCaptor.capture());
        Set<String> endpoints = pointsCaptor.getValue().stream()
                .map(IngestRequest.Point::endpoint)
                .collect(Collectors.toSet());
        assertTrue(endpoints.containsAll(Set.of("views", "downloads")), endpoints.toString());

        verify(service).snapshot(eq("snapshot/github/owner/repo"), eq("stars"), eq(12L), anyLong());
        verify(service).snapshot(eq("snapshot/github/owner/repo"), eq("forks"), eq(3L), anyLong());
        verify(service).snapshot(eq("snapshot/github/owner/repo"), eq("watchers"), eq(2L), anyLong());
        verify(service).snapshot(eq("snapshot/github/owner/repo"), eq("openIssues"), eq(1L), anyLong());
    }
}
