package com.imhgl.workbench.infrastructure.storage;

import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.stream.Stream;

/**
 * 通用文件树存储（技术设施）：根目录内受控的文件读写与树构建，不依赖任何业务模块。
 * <p>安全约束：所有相对路径必须经 {@link #resolve(String)} 防穿越校验；文件写入仅允许白名单扩展名；
 * 根目录自身的重命名与删除被拒绝；重命名目标不得落在源目录子树内。
 * 业务模块只能通过本类的受控入口访问文件系统。
 */
@Service
public class FileTreeStorage {

    private final FileStorageProperties properties;
    private final Path root;

    public FileTreeStorage(FileStorageProperties properties) {
        this.properties = properties;
        this.root = Paths.get(properties.root()).toAbsolutePath().normalize();
        try {
            Files.createDirectories(root);
        } catch (IOException e) {
            throw new UncheckedIOException("无法创建存储根目录：" + root, e);
        }
    }

    public Path getRoot() {
        return root;
    }

    /** 将相对路径解析为根目录内的绝对路径，拒绝穿越、根绝对写法与空字节 */
    public Path resolve(String relPath) {
        if (relPath == null) {
            return root;
        }
        String cleaned = relPath.replace('\\', '/').trim();
        if (cleaned.isEmpty() || cleaned.equals(".")) {
            return root;
        }
        if (cleaned.contains("\0") || cleaned.startsWith("/")) {
            throw new IllegalArgumentException("非法路径：" + relPath);
        }
        Path resolved = root.resolve(cleaned).normalize();
        if (!resolved.startsWith(root)) {
            throw new IllegalArgumentException("路径越界：" + relPath);
        }
        return resolved;
    }

    /** 校验文件/目录名（单段，不含分隔符） */
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

    /** 校验路径的扩展名在白名单内（小写比对，故大写扩展名同样放行） */
    public void validateExtension(Path path) {
        String ext = extensionOf(path);
        if (!properties.allowedExtensions().contains(ext)) {
            throw new IllegalArgumentException(
                    "仅支持 " + properties.allowedExtensions().stream().sorted().map(e -> "." + e)
                            .reduce((a, b) -> a + " / " + b).orElse("") + " 文件");
        }
    }

    /** 是否为白名单内的文件（树构建与搜索共用） */
    public boolean isAllowedFile(Path p) {
        return properties.allowedExtensions().contains(extensionOf(p));
    }

    /** 构建根目录下的文件树（目录优先、名称不分大小写排序，只含白名单文件） */
    public StorageNode tree() throws IOException {
        return buildNode(root, "");
    }

    /** 读取文本文件内容（UTF-8），文件不存在抛 IllegalArgumentException */
    public String read(String relPath) throws IOException {
        Path path = resolve(relPath);
        if (!Files.isRegularFile(path)) {
            throw new IllegalArgumentException("文件不存在：" + relPath);
        }
        return Files.readString(path, StandardCharsets.UTF_8);
    }

    public void create(String relPath, String content) throws IOException {
        Path path = resolve(relPath);
        validateExtension(path);
        if (Files.exists(path)) {
            throw new IllegalArgumentException("文件已存在：" + relPath);
        }
        Files.createDirectories(path.getParent());
        Files.writeString(path, content == null ? "" : content, StandardCharsets.UTF_8);
    }

    public void save(String relPath, String content) throws IOException {
        Path path = resolve(relPath);
        validateExtension(path);
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
        if (src.equals(root)) {
            throw new IllegalArgumentException("不能重命名存储根目录");
        }
        if (!Files.exists(src)) {
            throw new IllegalArgumentException("源路径不存在：" + from);
        }
        if (Files.exists(dst)) {
            throw new IllegalArgumentException("目标已存在：" + to);
        }
        if (dst.startsWith(src)) {
            throw new IllegalArgumentException("目标路径位于源路径内部：" + to);
        }
        if (Files.isRegularFile(src)) {
            validateExtension(dst);
        }
        Files.createDirectories(dst.getParent());
        Files.move(src, dst);
    }

    public void delete(String relPath) throws IOException {
        Path path = resolve(relPath);
        if (path.equals(root)) {
            throw new IllegalArgumentException("不能删除存储根目录");
        }
        if (!Files.exists(path)) {
            throw new IllegalArgumentException("路径不存在：" + relPath);
        }
        try (Stream<Path> stream = Files.walk(path)) {
            stream.sorted(Comparator.reverseOrder()).forEach(p -> {
                try {
                    Files.delete(p);
                } catch (IOException e) {
                    throw new UncheckedIOException(e);
                }
            });
        } catch (UncheckedIOException e) {
            throw (IOException) e.getCause();
        }
    }

    /** 绝对路径转根目录内相对路径（正斜杠分隔） */
    public String toRel(Path path) {
        return root.relativize(path).toString().replace('\\', '/');
    }

    private StorageNode buildNode(Path dir, String relPath) throws IOException {
        try (Stream<Path> stream = Files.list(dir)) {
            List<Path> entries = stream
                    .filter(p -> Files.isDirectory(p) || isAllowedFile(p))
                    .sorted(Comparator
                            .comparing((Path p) -> !Files.isDirectory(p))
                            .thenComparing(p -> p.getFileName().toString(), String.CASE_INSENSITIVE_ORDER))
                    .toList();
            StorageNode node = new StorageNode(dir.equals(root) ? "" : dir.getFileName().toString(), relPath, "dir");
            for (Path entry : entries) {
                String childRel = relPath.isEmpty()
                        ? entry.getFileName().toString()
                        : relPath + "/" + entry.getFileName().toString();
                if (Files.isDirectory(entry)) {
                    node.children().add(buildNode(entry, childRel));
                } else {
                    node.children().add(new StorageNode(entry.getFileName().toString(), childRel, "file"));
                }
            }
            return node;
        }
    }

    private String extensionOf(Path p) {
        String name = p.getFileName().toString();
        int dot = name.lastIndexOf('.');
        return dot < 0 ? "" : name.substring(dot + 1).toLowerCase(Locale.ROOT);
    }
}
