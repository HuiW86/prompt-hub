import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  FolderPlus,
  Globe2,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import { ipc } from "../ipc";
import type { Website, WebsiteGroup, WebsiteInput } from "../ipc/types";
import { useToastStore } from "../stores/toastStore";
import { useWebsiteStore } from "../stores/websiteStore";
import { isPrimaryModifier } from "../utils/platform";
import { toUserMessage } from "../utils/errorMessage";
import {
  AnchoredEditor,
  Button,
  EditorActions,
  EditorInput,
  EditorPanel,
  Input,
} from "./primitives";
import styles from "./WebsitePanel.module.css";

type Form =
  | { kind: "website"; anchor: HTMLElement; site?: Website }
  | { kind: "group"; anchor: HTMLElement; group?: WebsiteGroup };
const host = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

export function WebsitePanel() {
  const library = useWebsiteStore((s) => s.library);
  const loaded = useWebsiteStore((s) => s.loaded);
  const loading = useWebsiteStore((s) => s.loading);
  const busy = useWebsiteStore((s) => s.busy);
  const error = useWebsiteStore((s) => s.error);
  const query = useWebsiteStore((s) => s.query);
  const setQuery = useWebsiteStore((s) => s.setQuery);
  const refresh = useWebsiteStore((s) => s.refresh);
  const mutate = useWebsiteStore((s) => s.mutate);
  const show = useToastStore((s) => s.show);
  const showError = useToastStore((s) => s.showError);
  const showWithAction = useToastStore((s) => s.showWithAction);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [trash, setTrash] = useState(false);
  const [form, setForm] = useState<Form | null>(null);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [formGroupId, setFormGroupId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loaded) void refresh().catch(() => {});
  }, [loaded, refresh]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        !form &&
        isPrimaryModifier(e) &&
        !e.shiftKey &&
        !e.altKey &&
        e.key.toLowerCase() === "k"
      ) {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
      if (e.key === "Escape" && useWebsiteStore.getState().query && !form) {
        e.preventDefault();
        e.stopPropagation();
        setQuery("");
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [form, setQuery]);

  const run = async (op: () => Promise<unknown>, success?: string) => {
    try {
      await mutate(op);
      if (success) show(success);
      return true;
    } catch (err) {
      showError(toUserMessage(err, "操作失败，请重试"));
      return false;
    }
  };
  const openForm = (next: Form) => {
    setForm(next);
    setFormError(null);
    setName(
      next.kind === "website"
        ? (next.site?.name ?? "")
        : (next.group?.name ?? ""),
    );
    setUrl(next.kind === "website" ? (next.site?.url ?? "") : "");
    setDescription(
      next.kind === "website" ? (next.site?.description ?? "") : "",
    );
    setFormGroupId(
      next.kind === "website" ? (next.site?.groupId ?? groupId) : null,
    );
  };
  const save = async () => {
    if (!form || busy) return;
    if (!name.trim()) {
      setFormError("请输入名称");
      return;
    }
    if (form.kind === "website") {
      let parsed: URL;
      try {
        parsed = new URL(url.trim());
      } catch {
        setFormError("请输入完整网址，例如 https://example.com");
        return;
      }
      if (
        !["http:", "https:"].includes(parsed.protocol) ||
        !parsed.hostname ||
        parsed.username ||
        parsed.password
      ) {
        setFormError("只支持不含账号密码的 HTTP(S) 网址");
        return;
      }
      const input: WebsiteInput = {
        id: form.site?.id,
        name: name.trim(),
        url: url.trim(),
        description: description.trim(),
        groupId: formGroupId,
      };
      if (await run(() => ipc.saveWebsite(input), "网站已保存")) setForm(null);
    } else if (
      await run(
        () => ipc.saveWebsiteGroup(form.group?.id ?? null, name.trim()),
        "分组已保存",
      )
    )
      setForm(null);
  };
  const deleteSite = async (site: Website) => {
    if (!(await run(() => ipc.deleteWebsite(site.id)))) return;
    showWithAction(`已删除「${site.name}」`, {
      label: "撤销",
      onClick: () => {
        void run(() => ipc.restoreWebsite(site.id), "已恢复网站");
      },
    });
  };
  const restore = async (site: Website) => {
    await run(() => ipc.restoreWebsite(site.id), "已恢复网站");
  };
  const open = async (site: Website) => {
    try {
      await ipc.openWebsite(site.id);
      show("已交给默认浏览器打开");
    } catch (err) {
      showError(toUserMessage(err, "浏览器未能打开网址"));
    }
  };
  const moveSite = async (site: Website, direction: -1 | 1) => {
    const peers = library.websites.filter(
      (w) => !w.deletedAt && w.groupId === site.groupId,
    );
    const index = peers.findIndex((w) => w.id === site.id);
    const target = index + direction;
    if (target < 0 || target >= peers.length) return;
    const ids = peers.map((w) => w.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    await run(() => ipc.reorderWebsites(site.groupId, ids));
  };
  const moveGroup = async (group: WebsiteGroup, direction: -1 | 1) => {
    const ids = library.groups.map((g) => g.id);
    const index = ids.indexOf(group.id);
    const target = index + direction;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    await run(() => ipc.reorderWebsiteGroups(ids));
  };
  const normalized = query.trim().toLocaleLowerCase();
  const groupRank = (id: string | null) =>
    id === null ? -1 : library.groups.findIndex((group) => group.id === id);
  const sites = library.websites
    .filter(
      (site) =>
        Boolean(site.deletedAt) === trash &&
        (trash || groupId === null || site.groupId === groupId) &&
        (!normalized ||
          `${site.name} ${host(site.url)} ${site.description}`
            .toLocaleLowerCase()
            .includes(normalized)),
    )
    .sort(
      (a, b) =>
        groupRank(a.groupId) - groupRank(b.groupId) ||
        a.orderIndex - b.orderIndex,
    );
  const visibleGroup = library.groups.find((g) => g.id === groupId);
  useEffect(() => {
    if (loaded && groupId && !library.groups.some((g) => g.id === groupId))
      setGroupId(null);
  }, [loaded, groupId, library.groups]);

  return (
    <section className={styles.workspace} aria-label="常用网站">
      <aside className={styles.sidebar} aria-label="网站分组">
        <div className={styles.sideHeading}>
          快捷访问{" "}
          <span>{library.websites.filter((w) => !w.deletedAt).length}</span>
        </div>
        <button
          className={!trash && !groupId ? styles.selected : styles.groupButton}
          onClick={() => {
            setTrash(false);
            setGroupId(null);
          }}
        >
          全部网站
        </button>
        {library.groups.map((group, index) => (
          <div className={styles.groupRow} key={group.id}>
            <button
              className={
                !trash && groupId === group.id
                  ? styles.selected
                  : styles.groupButton
              }
              onClick={() => {
                setTrash(false);
                setGroupId(group.id);
              }}
            >
              {group.name}
            </button>
            <button
              className={styles.tiny}
              aria-label={`编辑分组 ${group.name}`}
              title="编辑分组"
              onClick={(e) =>
                openForm({ kind: "group", anchor: e.currentTarget, group })
              }
            >
              <Pencil size={12} />
            </button>
            <button
              className={styles.tiny}
              disabled={busy || index === 0}
              aria-label={`上移分组 ${group.name}`}
              onClick={() => void moveGroup(group, -1)}
            >
              <ArrowUp size={12} />
            </button>
            <button
              className={styles.tiny}
              disabled={busy || index === library.groups.length - 1}
              aria-label={`下移分组 ${group.name}`}
              onClick={() => void moveGroup(group, 1)}
            >
              <ArrowDown size={12} />
            </button>
          </div>
        ))}
        <button
          className={styles.addGroup}
          onClick={(e) => openForm({ kind: "group", anchor: e.currentTarget })}
        >
          <FolderPlus size={14} /> 新建分组
        </button>
        <div className={styles.sideFooter}>
          <button
            className={trash ? styles.selected : styles.groupButton}
            onClick={() => setTrash(true)}
          >
            <Trash2 size={14} /> 已删除{" "}
            <span>{library.websites.filter((w) => w.deletedAt).length}</span>
          </button>
        </div>
      </aside>
      <div className={styles.content}>
        <div className={styles.toolbar}>
          <div>
            <div className={styles.eyebrow}>WEBSITE LIBRARY</div>
            <h1>{trash ? "已删除" : (visibleGroup?.name ?? "常用网站")}</h1>
            <p>
              {trash ? "可随时恢复删除的网站" : "把常去的地方放在顺手的位置"}
            </p>
          </div>
          <div className={styles.actions}>
            <label className={styles.search}>
              <Search size={15} aria-hidden />
              <Input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索名称、域名或说明"
                aria-label="搜索网站"
              />
            </label>
            {!trash && (
              <Button
                intent="primary"
                onClick={(e) =>
                  openForm({ kind: "website", anchor: e.currentTarget })
                }
              >
                <Plus size={14} /> 添加网站
              </Button>
            )}
          </div>
        </div>
        {error && (
          <div role="alert" className={styles.message}>
            {error}{" "}
            <Button onClick={() => void refresh().catch(() => {})}>重试</Button>
          </div>
        )}
        {loading && !loaded ? (
          <div className={styles.message}>正在加载网站…</div>
        ) : sites.length === 0 ? (
          <div className={styles.empty}>
            <Globe2 size={26} strokeWidth={1.5} />
            <strong>
              {trash
                ? "这里还没有已删除的网站"
                : normalized
                  ? "没有匹配的网站"
                  : "把第一个常用网站放在这里"}
            </strong>
            <span>
              {!trash && !normalized ? "添加后即可从这里快速打开" : ""}
            </span>
          </div>
        ) : (
          <div className={styles.list}>
            {sites.map((site) => {
              const peers = library.websites.filter(
                (w) => !w.deletedAt && w.groupId === site.groupId,
              );
              const index = peers.findIndex((w) => w.id === site.id);
              return (
                <article className={styles.card} key={site.id}>
                  <span className={styles.siteIcon}>
                    <Globe2 size={17} />
                  </span>
                  <div className={styles.siteInfo}>
                    <strong>{site.name}</strong>
                    <span>
                      {host(site.url)}
                      {site.description && ` · ${site.description}`}
                      {!groupId &&
                        site.groupId &&
                        ` · ${library.groups.find((group) => group.id === site.groupId)?.name ?? "未分组"}`}
                    </span>
                  </div>
                  {trash ? (
                    <Button
                      intent="subtle"
                      disabled={busy}
                      onClick={() => void restore(site)}
                    >
                      <RotateCcw size={14} /> 恢复
                    </Button>
                  ) : (
                    <div className={styles.cardActions}>
                      <button
                        className={styles.tiny}
                        disabled={busy || index === 0 || Boolean(normalized)}
                        title={normalized ? "清除搜索后排序" : "上移"}
                        aria-label={`上移 ${site.name}`}
                        onClick={() => void moveSite(site, -1)}
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        className={styles.tiny}
                        disabled={
                          busy ||
                          index === peers.length - 1 ||
                          Boolean(normalized)
                        }
                        title={normalized ? "清除搜索后排序" : "下移"}
                        aria-label={`下移 ${site.name}`}
                        onClick={() => void moveSite(site, 1)}
                      >
                        <ArrowDown size={14} />
                      </button>
                      <button
                        className={styles.tiny}
                        disabled={busy}
                        aria-label={`编辑 ${site.name}`}
                        onClick={(e) =>
                          openForm({
                            kind: "website",
                            anchor: e.currentTarget,
                            site,
                          })
                        }
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        className={styles.tiny}
                        disabled={busy}
                        aria-label={`删除 ${site.name}`}
                        onClick={() => void deleteSite(site)}
                      >
                        <Trash2 size={14} />
                      </button>
                      <Button
                        intent="subtle"
                        disabled={busy}
                        onClick={() => void open(site)}
                      >
                        打开 <ExternalLink size={13} />
                      </Button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
        {!trash && visibleGroup && (
          <div className={styles.groupDanger}>
            <Button
              intent="ghost"
              disabled={busy}
              onClick={() => {
                void run(
                  () => ipc.deleteWebsiteGroup(visibleGroup.id),
                  "已删除分组，网站已移至全部网站",
                ).then((ok) => {
                  if (ok) setGroupId(null);
                });
              }}
            >
              删除此分组（保留网站）
            </Button>
          </div>
        )}
      </div>
      {form && (
        <AnchoredEditor
          anchor={form.anchor}
          ariaLabel={form.kind === "website" ? "编辑网站" : "编辑分组"}
          initialFocus={nameRef}
          onDismiss={() => {
            if (busy) return false;
            setForm(null);
            return true;
          }}
        >
          <EditorPanel className={styles.form}>
            <strong>
              {form.kind === "website"
                ? form.site
                  ? "编辑网站"
                  : "添加网站"
                : form.group
                  ? "编辑分组"
                  : "新建分组"}
            </strong>
            <label>
              名称
              <Input
                ref={nameRef}
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
              />
            </label>
            {form.kind === "website" && (
              <>
                <label>
                  网址
                  <Input
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://example.com"
                    type="url"
                  />
                </label>
                <label>
                  说明（可选）
                  <EditorInput
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={2000}
                  />
                </label>
                <label>
                  分组
                  <select
                    value={formGroupId ?? ""}
                    onChange={(e) => setFormGroupId(e.target.value || null)}
                  >
                    <option value="">未分组</option>
                    {library.groups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
            {formError && (
              <span role="alert" className={styles.formError}>
                {formError}
              </span>
            )}
            <EditorActions>
              <Button disabled={busy} onClick={() => setForm(null)}>
                取消
              </Button>
              <Button
                intent="primary"
                disabled={busy}
                onClick={() => void save()}
              >
                保存
              </Button>
            </EditorActions>
          </EditorPanel>
        </AnchoredEditor>
      )}
    </section>
  );
}
