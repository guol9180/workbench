package com.imhgl.workbench.monitor.collector;

import com.imhgl.workbench.common.exception.BusinessException;
import com.imhgl.workbench.common.exception.ErrorCode;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

/** 源配置存储：JSON 往返、id 归一、重复 repo 冲突、状态回写持久化（重启可见） */
class SourceConfigStoreTest {

    @TempDir
    Path temp;

    private SourceConfigStore newStore() {
        return new SourceConfigStore(new SourceConfigProperties(temp.resolve("sources.json").toString(), "", "-"));
    }

    @Test
    @DisplayName("create→list 往返；id 由 repo 归一（大小写不敏感）")
    void createAndRoundTrip() {
        SourceConfigStore store = newStore();
        store.create("github", "Guol9180/WorkBench", true, List.of("pages", "downloads"));
        List<SourceConfig> all = newStore().list();
        assertEquals(1, all.size());
        assertEquals("gh-guol9180-workbench", all.get(0).id());
        assertEquals(List.of("pages", "downloads"), all.get(0).metrics());
        assertNull(all.get(0).lastOkAt());
    }

    @Test
    @DisplayName("同 repo 重复接入（含大小写变体）→ CONFLICT")
    void duplicateRepoConflicts() {
        SourceConfigStore store = newStore();
        store.create("github", "owner/repo", true, List.of("pages"));
        BusinessException e = assertThrows(BusinessException.class,
                () -> store.create("github", "OWNER/REPO", true, List.of("downloads")));
        assertEquals(ErrorCode.CONFLICT, e.getErrorCode());
    }

    @Test
    @DisplayName("update 换 repo 时 pages 游标作废；markResult 持久化且成功清错误")
    void updateAndMarkResult() {
        SourceConfigStore store = newStore();
        store.create("github", "owner/repo", true, List.of("pages"));
        store.markResult("gh-owner-repo", false, "GitHub API 401", null);
        assertEquals("GitHub API 401", store.require("gh-owner-repo").lastError());

        store.markResult("gh-owner-repo", true, null, "2026-10-22");
        SourceConfig ok = store.require("gh-owner-repo");
        assertNull(ok.lastError());
        assertEquals("2026-10-22", ok.lastDay());

        store.update("gh-owner-repo", "github", "owner/other", false, List.of("downloads"));
        SourceConfig changed = store.require("gh-owner-repo");
        assertEquals("owner/other", changed.repo());
        assertNull(changed.lastDay());
        assertNull(changed.lastError());
    }

    @Test
    @DisplayName("删除后 require 抛 NOT_FOUND")
    void deleteThenNotFound() {
        SourceConfigStore store = newStore();
        store.create("github", "owner/repo", true, List.of("pages"));
        store.delete("gh-owner-repo");
        BusinessException e = assertThrows(BusinessException.class, () -> store.require("gh-owner-repo"));
        assertEquals(ErrorCode.NOT_FOUND, e.getErrorCode());
    }

    @Test
    @DisplayName("页面级 token 存于 settings 区：跨实例持久化，源操作不覆盖，清除后为 null")
    void githubTokenSettingsRoundTrip() {
        SourceConfigStore store = newStore();
        store.create("github", "owner/repo", true, List.of("pages"));
        store.setGithubToken("ghp_abc");
        assertEquals("ghp_abc", newStore().githubToken());

        // 源操作（状态回写）不得覆盖 settings 区
        store.markResult("gh-owner-repo", true, null, "2026-10-27");
        assertEquals("ghp_abc", store.githubToken());

        store.setGithubToken(null);
        assertNull(newStore().githubToken());
        assertEquals(1, newStore().list().size());
    }
}
