import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WebsiteLibrary } from "../../ipc/types";
import { useWebsiteStore } from "../../stores/websiteStore";
import { useToastStore } from "../../stores/toastStore";

const invokeMock = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));
import { WebsitePanel } from "../WebsitePanel";
import { Toast } from "../Toast";

function fixture(): WebsiteLibrary {
  return { groups: [], websites: [] };
}

describe("WebsitePanel — add, find, open, recover", () => {
  let library: WebsiteLibrary;
  beforeEach(() => {
    library = fixture();
    useWebsiteStore.setState({
      library,
      loaded: false,
      loading: false,
      busy: false,
      error: null,
      query: "",
    });
    useToastStore.getState().clear();
    invokeMock.mockReset();
    invokeMock.mockImplementation(
      async (cmd: string, args?: Record<string, unknown>) => {
        if (cmd === "list_websites") return structuredClone(library);
        if (cmd === "save_website") {
          const input = args!.input as {
            name: string;
            url: string;
            description: string;
            groupId: string | null;
          };
          library.websites.push({
            id: "w-1",
            name: input.name,
            url: input.url,
            description: input.description,
            groupId: input.groupId,
            orderIndex: 0,
            createdAt: new Date().toISOString(),
            deletedAt: null,
          });
          return;
        }
        if (cmd === "delete_website") {
          library.websites[0].deletedAt = new Date().toISOString();
          return;
        }
        if (cmd === "restore_website") {
          library.websites[0].deletedAt = null;
          return;
        }
        if (cmd === "open_website") return;
        throw new Error(`unexpected ${cmd}`);
      },
    );
  });
  it("creates a shortcut, searches its description, opens by stored ID, and restores deletion", async () => {
    render(
      <>
        <WebsitePanel />
        <Toast />
      </>,
    );
    await waitFor(() =>
      expect(screen.getByText("把第一个常用网站放在这里")).toBeTruthy(),
    );
    fireEvent.click(screen.getByText("添加网站"));
    fireEvent.change(screen.getByLabelText("名称"), {
      target: { value: "文档站" },
    });
    fireEvent.change(screen.getByLabelText("网址"), {
      target: { value: "https://example.com/docs" },
    });
    fireEvent.change(screen.getByLabelText("说明（可选）"), {
      target: { value: "查 API" },
    });
    fireEvent.click(screen.getByText("保存"));
    await waitFor(() => expect(screen.getByText("文档站")).toBeTruthy());
    fireEvent.change(screen.getByRole("searchbox", { name: "搜索网站" }), {
      target: { value: "查 API" },
    });
    expect(screen.getByText("文档站")).toBeTruthy();
    fireEvent.change(screen.getByRole("searchbox", { name: "搜索网站" }), {
      target: { value: "no-match" },
    });
    expect(screen.getByText("没有匹配的网站")).toBeTruthy();
    fireEvent.change(screen.getByRole("searchbox", { name: "搜索网站" }), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByText("打开"));
    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith("open_website", { id: "w-1" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "删除 文档站" }));
    await waitFor(() =>
      expect(screen.getByText("已删除「文档站」")).toBeTruthy(),
    );
    fireEvent.click(screen.getByText("撤销"));
    await waitFor(() => expect(screen.getByText("文档站")).toBeTruthy());
    expect(library.websites[0].deletedAt).toBeNull();
  });
  it("rejects a non-http URL before invoking persistence", async () => {
    render(<WebsitePanel />);
    await waitFor(() =>
      expect(screen.getByText("把第一个常用网站放在这里")).toBeTruthy(),
    );
    fireEvent.click(screen.getByText("添加网站"));
    fireEvent.change(screen.getByLabelText("名称"), {
      target: { value: "危险" },
    });
    fireEvent.change(screen.getByLabelText("网址"), {
      target: { value: "javascript:alert(1)" },
    });
    fireEvent.click(screen.getByText("保存"));
    expect(screen.getByRole("alert").textContent).toContain("HTTP(S)");
    expect(
      invokeMock.mock.calls.filter(([cmd]) => cmd === "save_website"),
    ).toHaveLength(0);
  });
});
