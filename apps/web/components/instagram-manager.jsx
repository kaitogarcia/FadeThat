"use client";

import { useEffect, useMemo, useState } from "react";

const apiBaseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
const ASCII_FRAMES = ["[|....]", "[/....]", "[-....]", "[\\....]"];

function buildApiUrl(path) {
  if (!apiBaseUrl) {
    return path;
  }
  return `${apiBaseUrl}${path}`;
}

function readErrorMessage(error, fallback) {
  if (!error) {
    return fallback;
  }
  return error.message || fallback;
}

function truncateCaption(value, max = 110) {
  if (!value) {
    return "";
  }
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max - 3)}...`;
}

export default function InstagramManager() {
  const [token, setToken] = useState("");
  const [context, setContext] = useState(null);
  const [media, setMedia] = useState([]);
  const [accessMode, setAccessMode] = useState("direct");
  const [actionsRemaining, setActionsRemaining] = useState(null);

  const [bootLoading, setBootLoading] = useState(false);
  const [bootError, setBootError] = useState("");

  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaError, setMediaError] = useState("");

  const [selectedMedia, setSelectedMedia] = useState(() => new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkStatus, setBulkStatus] = useState("No bulk action has run yet.");
  const [bulkLogs, setBulkLogs] = useState([]);

  const [uploadFiles, setUploadFiles] = useState([]);
  const [job, setJob] = useState(null);
  const [jobError, setJobError] = useState("");
  const [pollTick, setPollTick] = useState(0);

  const hasToken = token.trim().length > 0;
  const selectionCount = selectedMedia.size;
  const isJobActive = Boolean(job && (job.status === "queued" || job.status === "processing"));

  const profile = context?.profile || null;
  const igUserId = context?.ig_user_id || "";

  const sortedSelectedIds = useMemo(() => Array.from(selectedMedia).sort(), [selectedMedia]);

  const statusFrame = ASCII_FRAMES[pollTick % ASCII_FRAMES.length];
  const uploadStatusLine = isJobActive
    ? `${statusFrame} posting ${job.completed}/${job.total}`
    : job
      ? `[done] status=${job.status} posted=${job.completed} failed=${job.failed}`
      : "[idle] waiting for a mass post job";

  const getTokenForRequest = () => {
    return token.trim();
  };

  const applyAccessMeta = (payload) => {
    const mode = payload?.access_mode || "direct";
    setAccessMode(mode);
    if (mode === "baby") {
      setActionsRemaining(Number(payload?.actions_remaining ?? 0));
    } else {
      setActionsRemaining(null);
    }
  };

  const refreshMedia = async () => {
    if (!hasToken || !igUserId) {
      return;
    }

    setMediaLoading(true);
    setMediaError("");
    try {
      const response = await fetch(buildApiUrl("/api/instagram/media"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          access_token: getTokenForRequest(),
          ig_user_id: igUserId,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.detail || `Failed to fetch media (${response.status}).`);
      }

      const payload = await response.json();
      applyAccessMeta(payload);
      setMedia(Array.isArray(payload.media) ? payload.media : []);
      setContext((current) => {
        if (!current) {
          return current;
        }
        return {
          ...current,
          profile: payload.profile || current.profile,
        };
      });
      setSelectedMedia(new Set());
    } catch (error) {
      setMediaError(readErrorMessage(error, "Unable to refresh media right now."));
    } finally {
      setMediaLoading(false);
    }
  };

  const handleBoot = async (event) => {
    event.preventDefault();
    const normalized = getTokenForRequest();
    if (!normalized) {
      return;
    }

    setBootLoading(true);
    setBootError("");
    try {
      const response = await fetch(buildApiUrl("/api/instagram/session"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          access_token: normalized,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.detail || `Could not connect token (${response.status}).`);
      }

      const payload = await response.json();
      applyAccessMeta(payload);
      setContext(payload);
      setMedia(Array.isArray(payload.media) ? payload.media : []);
      setSelectedMedia(new Set());
      setBulkStatus("No bulk action has run yet.");
      setBulkLogs([]);
      setJob(null);
      setJobError("");
      setPollTick(0);
    } catch (error) {
      setBootError(readErrorMessage(error, "Unable to connect token."));
    } finally {
      setBootLoading(false);
    }
  };

  const toggleMediaSelection = (mediaId) => {
    setSelectedMedia((current) => {
      const next = new Set(current);
      if (next.has(mediaId)) {
        next.delete(mediaId);
      } else {
        next.add(mediaId);
      }
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelectedMedia(new Set(media.map((item) => item.id).filter(Boolean)));
  };

  const clearSelection = () => {
    setSelectedMedia(new Set());
  };

  const runBulkAction = async (action) => {
    if (!selectionCount || !hasToken) {
      return;
    }

    setBulkLoading(true);
    setBulkStatus(`${action} in progress for ${selectionCount} selected item(s)...`);
    try {
      const response = await fetch(buildApiUrl("/api/instagram/media/bulk-action"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          access_token: getTokenForRequest(),
          action,
          ig_user_id: igUserId,
          media_ids: sortedSelectedIds,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.detail || `Bulk action failed (${response.status}).`);
      }

      const payload = await response.json();
      applyAccessMeta(payload);
      const successCount = Array.isArray(payload.successes) ? payload.successes.length : 0;
      const failureCount = Array.isArray(payload.failures) ? payload.failures.length : 0;
      setBulkLogs(Array.isArray(payload.logs) ? payload.logs : []);
      setBulkStatus(
        `${action} complete: ${successCount} success, ${failureCount} failed.`
      );

      await refreshMedia();
    } catch (error) {
      setBulkStatus(readErrorMessage(error, "Bulk action failed."));
    } finally {
      setBulkLoading(false);
    }
  };

  const startPostJob = async () => {
    if (!hasToken || !igUserId || !uploadFiles.length || isJobActive) {
      return;
    }

    setJobError("");
    const formData = new FormData();
    formData.append("access_token", getTokenForRequest());
    formData.append("ig_user_id", igUserId);
    uploadFiles.forEach((file) => {
      formData.append("files", file);
    });

    try {
      const response = await fetch(buildApiUrl("/api/instagram/post-jobs"), {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.detail || `Could not start mass post job (${response.status}).`);
      }

      const payload = await response.json();
      applyAccessMeta(payload);
      setJob(payload);
      setPollTick(0);
      setBulkStatus("Mass post agent started.");
    } catch (error) {
      setJobError(readErrorMessage(error, "Unable to create mass post job."));
    }
  };

  useEffect(() => {
    if (!job?.id || !isJobActive) {
      return undefined;
    }

    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(buildApiUrl(`/api/instagram/post-jobs/${job.id}`), {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`Polling failed (${response.status}).`);
        }

        const payload = await response.json();
        setJob(payload);
        setPollTick((value) => value + 1);

        if (!["queued", "processing"].includes(payload.status)) {
          if (["completed", "partial"].includes(payload.status)) {
            await refreshMedia();
          }
        }
      } catch (error) {
        setJobError(readErrorMessage(error, "Lost progress polling for the mass post job."));
      }
    }, 2000);

    return () => {
      window.clearInterval(timer);
    };
  }, [isJobActive, job?.id]);

  if (!context) {
    return (
      <section className="ig-stage" aria-label="Instagram token setup">
        <form className="ig-token-card" onSubmit={handleBoot}>
          <p className="ig-token-label-row">
            <span>Facebook Graph API Access Token</span>
            <span className="ig-tooltip-wrap" tabIndex={0}>
              <span className="ig-info-icon" aria-hidden="true">i</span>
              <span className="ig-tooltip" role="tooltip">
                Obtain Facebook Graph API Access Token from
                <br />
                <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noreferrer">
                  https://developers.facebook.com/tools/explorer/
                </a>
                <br />
                Generate a "User Token" with permissions:
                <br />
                email
                <br />
                pages_show_list
                <br />
                business_management
                <br />
                instagram_basic
                <br />
                instagram_content_publish
                <br />
                pages_read_user_content
              </span>
            </span>
          </p>

          <input
            className="ig-token-input"
            type="password"
            autoComplete="off"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            aria-label="Facebook Graph API Access Token"
          />

          {hasToken ? (
            <button className="ig-token-submit" type="submit" disabled={bootLoading}>
              {bootLoading ? "Connecting..." : "Submit"}
            </button>
          ) : null}

          {bootError ? <p className="ig-inline-error">{bootError}</p> : null}
        </form>
      </section>
    );
  }

  return (
    <section className="ig-manager" aria-label="Instagram manager">
      <header className="ig-profile-shell">
        <div className="ig-avatar-frame" aria-hidden="true">
          {profile?.profile_picture_url ? (
            <img src={profile.profile_picture_url} alt="" />
          ) : (
            <span>{(profile?.username || "ig").slice(0, 2).toUpperCase()}</span>
          )}
        </div>

        <div className="ig-profile-core">
          <div className="ig-headline-row">
            <h1>@{profile?.username || "instagram"}</h1>
            <button className="ig-ghost" type="button" onClick={refreshMedia} disabled={mediaLoading}>
              {mediaLoading ? "refreshing..." : "refresh"}
            </button>
          </div>

          <p className="ig-profile-stats">
            <strong>{profile?.media_count || media.length}</strong> posts
            <strong>{profile?.followers_count || 0}</strong> followers
            <strong>{profile?.follows_count || 0}</strong> following
          </p>

          {profile?.name ? <p className="ig-display-name">{profile.name}</p> : null}
          {profile?.biography ? <p className="ig-bio">{profile.biography}</p> : null}
          {profile?.website ? (
            <p className="ig-site">
              <a href={profile.website} target="_blank" rel="noreferrer">
                {profile.website}
              </a>
            </p>
          ) : null}

          <p className="ig-page-meta">
            {context.page_name ? `Connected page: ${context.page_name}` : "Connected via Graph API token"}
          </p>
          {accessMode === "baby" ? (
            <p className="ig-page-meta">
              <strong>{actionsRemaining ?? 0}</strong> action(s) remaining for baby access
            </p>
          ) : null}
        </div>
      </header>

      <section className="ig-tool-grid" aria-label="Instagram tooling controls">
        <article className="ig-panel">
          <h2>Mass Post Agent</h2>
          <p className="ig-subtle">Upload photos and post them one by one with a 10-second buffer.</p>

          <label className="ig-upload-label" htmlFor="ig-upload-input">Photo uploader</label>
          <input
            id="ig-upload-input"
            className="ig-upload-input"
            type="file"
            accept="image/*"
            multiple
            onChange={(event) => setUploadFiles(Array.from(event.target.files || []))}
            disabled={isJobActive}
          />

          <p className="ig-file-count">{uploadFiles.length} file(s) selected</p>

          <button
            className="ig-primary"
            type="button"
            disabled={!uploadFiles.length || isJobActive}
            onClick={startPostJob}
          >
            {isJobActive ? "posting in progress..." : "start mass post"}
          </button>

          <pre className="ig-ascii-status">{uploadStatusLine}</pre>

          {job?.logs?.length ? (
            <div className="ig-log-stream" aria-live="polite">
              {job.logs.slice(-8).map((line, index) => (
                <p key={`${index}-${line}`}>{line}</p>
              ))}
            </div>
          ) : null}

          {jobError ? <p className="ig-inline-error">{jobError}</p> : null}
        </article>

        <article className="ig-panel">
          <h2>Mass Select + Delete/Archive</h2>
          <p className="ig-subtle">Select media directly from your grid and run bulk actions.</p>

          <div className="ig-bulk-row">
            <button className="ig-ghost" type="button" onClick={selectAllVisible}>
              select all
            </button>
            <button className="ig-ghost" type="button" onClick={clearSelection}>
              clear
            </button>
          </div>

          <div className="ig-bulk-row">
            <button
              className="ig-warn"
              type="button"
              onClick={() => runBulkAction("delete")}
              disabled={!selectionCount || bulkLoading}
            >
              delete selected ({selectionCount})
            </button>
            <button
              className="ig-ghost"
              type="button"
              onClick={() => runBulkAction("archive")}
              disabled={!selectionCount || bulkLoading}
            >
              archive selected ({selectionCount})
            </button>
          </div>

          <p className="ig-subtle">{bulkStatus}</p>
          {bulkLogs.length ? (
            <div className="ig-log-stream" aria-live="polite">
              {bulkLogs.slice(-8).map((line, index) => (
                <p key={`${index}-${line}`}>{line}</p>
              ))}
            </div>
          ) : null}
          {mediaError ? <p className="ig-inline-error">{mediaError}</p> : null}
        </article>
      </section>

      <section className="ig-gallery" aria-label="Instagram media gallery">
        {media.map((item) => {
          const mediaPreview = item.media_url || item.thumbnail_url;
          const isSelected = selectedMedia.has(item.id);
          return (
            <article className={`ig-media-card${isSelected ? " is-selected" : ""}`} key={item.id}>
              <label className="ig-media-select-surface">
                <input
                  className="ig-media-checkbox"
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleMediaSelection(item.id)}
                  aria-label={`Select media ${item.id}`}
                />
                <span className={`ig-select-check${isSelected ? " is-selected" : ""}`} aria-hidden="true" />
                {mediaPreview ? (
                  <img src={mediaPreview} alt="Instagram media" loading="lazy" />
                ) : (
                  <div className="ig-empty-thumb">no preview</div>
                )}
              </label>

              <div className="ig-media-meta">
                <p>
                  <strong>{item.like_count || 0}</strong> likes{" "}
                  {truncateCaption(item.caption || item.media_type || "Instagram media")}
                </p>
                {item.permalink ? (
                  <a href={item.permalink} target="_blank" rel="noreferrer">
                    open post
                  </a>
                ) : null}
              </div>
            </article>
          );
        })}
      </section>
    </section>
  );
}
