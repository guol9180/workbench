package com.imhgl.model;

public class SearchHit {

    private String path;
    private String snippet;

    public SearchHit() {
    }

    public SearchHit(String path, String snippet) {
        this.path = path;
        this.snippet = snippet;
    }

    public String getPath() {
        return path;
    }

    public void setPath(String path) {
        this.path = path;
    }

    public String getSnippet() {
        return snippet;
    }

    public void setSnippet(String snippet) {
        this.snippet = snippet;
    }
}
