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
 *
 * <p>受控入口清单（业务模块只能经由这些方法访问文件系统，不允许自行拿 Path 操作）：
 * {@link #resolve}、{@link #validateName}、{@link #validateExtension}、{@link #isAllowedFile}、
 * {@link #tree}、{@link #listAllowedFiles}、{@link #read}、{@link #create}、{@link #save}、
 * {@link #createDir}、{@link #rename}、{@link #delete}、{@link #toRel}。
 *
 * <p>抛错约定：非法输入（路径穿越、非法名、白名单外扩展名）抛 {@link IllegalArgumentException}；
 * 资源不存在抛 {@link StorageException}(NOT_FOUND)；已存在等状态冲突抛 {@link StorageException}(CONFLICT)。
 *
 * <p>安全设计：所有相对路径先经 {@link #resolve(String)} 归一化并防穿越校验；文件写入仅允许白名单扩展名；
 * 根目录自身不可重命名/删除；重命名目标不得落在源目录子树内（否则目录会被移动进自己）。
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

    /**
     * 将相对路径解析为根目录内的绝对路径（所有读写的必经入口）。
     *
     * @throws IllegalArgumentException 空字节、根绝对写法（/x）、穿越（../）或越出根目录
     */
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

    /**
     * 校验单段名称（不含分隔符），用于重命名/新建前的输入把关。
     *
     * @throws IllegalArgumentException 空名、含分隔符或点段
     */
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

    /**
     * 校验路径的扩展名在白名单内（白名单小写存储、此处小写比对，故大写扩展名同样放行）。
     *
     * @throws IllegalArgumentException 扩展名不在白名单
     */
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

    /**
     * 构建根目录下的文件树（目录优先、名称不分大小写排序，只含白名单文件）。
     *
     * @return 根节点（name 为空串，children 恒非 null）
     */
    public StorageNode tree() throws IOException {
        return buildNode(root, "");
    }

    /**
     * 列举根目录内全部白名单文件的相对路径（正斜杠、字典序）。
     * 目录列举是元数据操作，一次物化开销很小——真正的开销在内容读取，由调用方按需懒读。
     *
     * @throws IOException 目录遍历失败
     */
    public List<String> listAllowedFiles() throws IOException {
        try (Stream<Path> stream = Files.walk(root)) {
            return stream
                    .filter(Files::isRegularFile)
                    .filter(this::isAllowedFile)
                    .map(this::toRel)
                    .sorted()
                    .toList();
        }
    }

    /**
     * 读取文本文件内容（UTF-8）。
     *
     * @throws StorageException 文件不存在（NOT_FOUND）
     * @throws IOException      读取失败
     */
    public String read(String relPath) throws IOException {
        Path path = resolve(relPath);
        if (!Files.isRegularFile(path)) {
            throw new StorageException(StorageException.Reason.NOT_FOUND, "文件不存在：" + relPath);
        }
        return Files.readString(path, StandardCharsets.UTF_8);
    }

    /**
     * 新建文件（父目录自动创建）。
     *
     * @throws StorageException            文件已存在（CONFLICT）
     * @throws IllegalArgumentException    扩展名不在白名单或路径非法
     * @throws IOException                 写入失败
     */
    public void create(String relPath, String content) throws IOException {
        Path path = resolve(relPath);
        validateExtension(path);
        if (Files.exists(path)) {
            throw new StorageException(StorageException.Reason.CONFLICT, "文件已存在：" + relPath);
        }
        Files.createDirectories(path.getParent());
        Files.writeString(path, content == null ? "" : content, StandardCharsets.UTF_8);
    }

    /**
     * 覆盖保存已存在的文件（content 为 null 按空串处理）。
     *
     * @throws StorageException            文件不存在（NOT_FOUND）
     * @throws IllegalArgumentException    扩展名不在白名单或路径非法
     * @throws IOException                 写入失败
     */
    public void save(String relPath, String content) throws IOException {
        Path path = resolve(relPath);
        validateExtension(path);
        if (!Files.isRegularFile(path)) {
            throw new StorageException(StorageException.Reason.NOT_FOUND, "文件不存在：" + relPath);
        }
        Files.writeString(path, content == null ? "" : content, StandardCharsets.UTF_8);
    }

    /**
     * 新建目录（含多级父目录）。
     *
     * @throws StorageException            目录已存在（CONFLICT）
     * @throws IOException                 创建失败
     */
    public void createDir(String relPath) throws IOException {
        Path path = resolve(relPath);
        if (Files.exists(path)) {
            throw new StorageException(StorageException.Reason.CONFLICT, "目录已存在：" + relPath);
        }
        Files.createDirectories(path);
    }

    /**
     * 重命名/移动文件或目录。
     *
     * @throws StorageException            源不存在（NOT_FOUND）或目标已存在（CONFLICT）
     * @throws IllegalArgumentException    重命名根目录、目标落在源目录子树内、目标扩展名不在白名单
     * @throws IOException                 移动失败
     */
    public void rename(String from, String to) throws IOException {
        Path src = resolve(from);
        Path dst = resolve(to);
        if (src.equals(root)) {
            throw new IllegalArgumentException("不能重命名存储根目录");
        }
        if (!Files.exists(src)) {
            throw new StorageException(StorageException.Reason.NOT_FOUND, "源路径不存在：" + from);
        }
        if (Files.exists(dst)) {
            throw new StorageException(StorageException.Reason.CONFLICT, "目标已存在：" + to);
        }
        // 子树守卫：把目录移动进自己会让子树失去统一入口，直接拒绝而非依赖文件系统报错
        if (dst.startsWith(src)) {
            throw new IllegalArgumentException("目标路径位于源路径内部：" + to);
        }
        if (Files.isRegularFile(src)) {
            validateExtension(dst);
        }
        Files.createDirectories(dst.getParent());
        Files.move(src, dst);
    }

    /**
     * 删除文件或目录（目录递归删除）。
     *
     * @throws StorageException            路径不存在（NOT_FOUND）
     * @throws IllegalArgumentException    试图删除存储根目录
     * @throws IOException                 删除失败
     */
    public void delete(String relPath) throws IOException {
        Path path = resolve(relPath);
        if (path.equals(root)) {
            throw new IllegalArgumentException("不能删除存储根目录");
        }
        if (!Files.exists(path)) {
            throw new StorageException(StorageException.Reason.NOT_FOUND, "路径不存在：" + relPath);
        }
        try (Stream<Path> stream = Files.walk(path)) {
            // 逆序删除：必须先删子项再删父项
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

    /** 绝对路径转根目录内相对路径（正斜杠分隔，供树构建与搜索使用） */
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
