package com.imhgl.service;

import com.imhgl.config.DocsProperties;
import com.imhgl.model.DocContent;
import com.imhgl.model.DocNode;
import com.imhgl.model.SearchHit;
import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Stream;

@Service
public class DocService {

    private static final Set<String> ALLOWED_EXTENSIONS = Set.of("md", "markdown", "txt");
    private static final int SEARCH_LIMIT = 100;
    private static final int SNIPPET_LENGTH = 120;

    private final DocsProperties properties;
    private Path root;

    public DocService(DocsProperties properties) {
        this.properties = properties;
    }

    @PostConstruct
    public void init() throws IOException {
        root = Paths.get(properties.getDocsRoot()).toAbsolutePath().normalize();
        Files.createDirectories(root);
    }

    public Path getRoot() {
        return root;
    }

    /** 将相对路径解析为根目录内的绝对路径，拒绝路径穿越 */
    public Path resolve(String relPath) {
        if (relPath == null) {
            return root;
        }
        String cleaned = relPath.replace('\\', '/').trim();
        while (cleaned.startsWith("/")) {
            cleaned = cleaned.substring(1);
        }
        if (cleaned.isEmpty() || cleaned.equals(".")) {
            return root;
        }
        if (cleaned.contains("\0")) {
            throw new IllegalArgumentException("非法路径");
        }
        Path resolved = root.resolve(cleaned).normalize();
        if (!resolved.startsWith(root)) {
            throw new IllegalArgumentException("路径越界：" + relPath);
        }
        return resolved;
    }

    /** 校验文件名（单段，不含分隔符） */
    public void validateName(String name) {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("名称不能为空");
        }
        if (name.contains("/") || name.contains("\\") || name.contains("\0")) {
            throw new IllegalArgumentException("名称不能包含路径分隔符");
        }
        if (name.equals(".") || name.equals("..")) {
            throw new IllegalArgumentException("非法名称");
        }
    }

    public void validateDocPath(Path path) {
        String name = path.getFileName().toString();
        int dot = name.lastIndexOf('.');
        String ext = dot >= 0 ? name.substring(dot + 1).toLowerCase(Locale.ROOT) : "";
        if (!ALLOWED_EXTENSIONS.contains(ext)) {
            throw new IllegalArgumentException("仅支持 .md / .markdown / .txt 文件");
        }
    }

    public DocNode tree() throws IOException {
        return buildNode(root, "");
    }

    private DocNode buildNode(Path dir, String relPath) throws IOException {
        DocNode node = new DocNode();
        node.setName(dir.equals(root) ? "文档库" : dir.getFileName().toString());
        node.setPath(relPath);
        node.setType("dir");
        try (Stream<Path> stream = Files.list(dir)) {
            List<Path> entries = stream
                    .filter(p -> Files.isDirectory(p) || isDocFile(p))
                    .sorted(Comparator
                            .comparing((Path p) -> !Files.isDirectory(p))
                            .thenComparing(p -> p.getFileName().toString(), String.CASE_INSENSITIVE_ORDER))
                    .toList();
            for (Path entry : entries) {
                String childRel = relPath.isEmpty()
                        ? entry.getFileName().toString()
                        : relPath + "/" + entry.getFileName().toString();
                if (Files.isDirectory(entry)) {
                    node.getChildren().add(buildNode(entry, childRel));
                } else {
                    node.getChildren().add(new DocNode(entry.getFileName().toString(), childRel, "file"));
                }
            }
        }
        return node;
    }

    private boolean isDocFile(Path p) {
        String name = p.getFileName().toString();
        int dot = name.lastIndexOf('.');
        if (dot < 0) {
            return false;
        }
        return ALLOWED_EXTENSIONS.contains(name.substring(dot + 1).toLowerCase(Locale.ROOT));
    }

    public DocContent read(String relPath) throws IOException {
        Path path = resolve(relPath);
        if (!Files.isRegularFile(path)) {
            throw new IllegalArgumentException("文件不存在：" + relPath);
        }
        String content = Files.readString(path, StandardCharsets.UTF_8);
        return new DocContent(toRel(path), path.getFileName().toString(), content);
    }

    public void create(String relPath, String content) throws IOException {
        Path path = resolve(relPath);
        validateDocPath(path);
        if (Files.exists(path)) {
            throw new IllegalArgumentException("文件已存在：" + relPath);
        }
        Files.createDirectories(path.getParent());
        Files.writeString(path, content == null ? "" : content, StandardCharsets.UTF_8);
    }

    public void save(String relPath, String content) throws IOException {
        Path path = resolve(relPath);
        validateDocPath(path);
        if (!Files.isRegularFile(path)) {
            throw new IllegalArgumentException("文件不存在：" + relPath);
        }
        Files.writeString(path, content == null ? "" : content, StandardCharsets.UTF_8);
    }

    public void createDir(String relPath) throws IOException {
        Path path = resolve(relPath);
        if (Files.exists(path)) {
            throw new IllegalArgumentException("目录已存在：" + relPath);
        }
        Files.createDirectories(path);
    }

    public void rename(String from, String to) throws IOException {
        Path src = resolve(from);
        Path dst = resolve(to);
        if (!Files.exists(src)) {
            throw new IllegalArgumentException("源路径不存在：" + from);
        }
        if (Files.exists(dst)) {
            throw new IllegalArgumentException("目标已存在：" + to);
        }
        if (Files.isRegularFile(src)) {
            validateDocPath(dst);
        }
        Files.createDirectories(dst.getParent());
        Files.move(src, dst);
    }

    public void delete(String relPath) throws IOException {
        Path path = resolve(relPath);
        if (path.equals(root)) {
            throw new IllegalArgumentException("不能删除文档库根目录");
        }
        if (!Files.exists(path)) {
            throw new IllegalArgumentException("路径不存在：" + relPath);
        }
        try (Stream<Path> stream = Files.walk(path)) {
            List<Path> toDelete = stream.sorted(Comparator.reverseOrder()).toList();
            for (Path p : toDelete) {
                Files.delete(p);
            }
        }
    }

    public List<SearchHit> search(String query) throws IOException {
        String q = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
        List<SearchHit> hits = new ArrayList<>();
        if (q.isEmpty()) {
            return hits;
        }
        try (Stream<Path> stream = Files.walk(root)) {
            for (Path p : stream.filter(Files::isRegularFile).filter(this::isDocFile).sorted().toList()) {
                String hit = matchFile(p, q);
                if (hit != null) {
                    hits.add(new SearchHit(toRel(p), hit));
                    if (hits.size() >= SEARCH_LIMIT) {
                        break;
                    }
                }
            }
        }
        return hits;
    }

    private String matchFile(Path file, String lowerQuery) {
        String name = file.getFileName().toString();
        String snippet = null;
        if (name.toLowerCase(Locale.ROOT).contains(lowerQuery)) {
            snippet = "【文件名匹配】" + name;
        }
        try {
            String content = Files.readString(file, StandardCharsets.UTF_8);
            String[] lines = content.split("\n", -1);
            for (String line : lines) {
                if (line.toLowerCase(Locale.ROOT).contains(lowerQuery)) {
                    String trimmed = line.strip();
                    if (trimmed.length() > SNIPPET_LENGTH) {
                        trimmed = trimmed.substring(0, SNIPPET_LENGTH) + "…";
                    }
                    snippet = (snippet == null ? "" : snippet + " / ") + trimmed;
                    break;
                }
            }
        } catch (IOException ignored) {
            // 跳过无法读取的文件
        }
        return snippet;
    }

    private String toRel(Path path) {
        return root.relativize(path).toString().replace('\\', '/');
    }
}
