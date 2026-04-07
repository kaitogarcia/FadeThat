"use client";

import { useMemo, useState } from "react";

const apiBaseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");

function buildApiUrl(path) {
  if (!apiBaseUrl) {
    return path;
  }

  return `${apiBaseUrl}${path}`;
}

function parseTrackTitles(rawValue) {
  return rawValue
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

async function mockScrapeRequest(payload) {
  await new Promise((resolve) => window.setTimeout(resolve, 700));

  return {
    results: payload.tracks.map((title) => ({
      title,
      url: `https://www.youtube.com/watch?v=${encodeURIComponent(
        title.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 11) || "example12345"
      )}`,
    })),
  };
}

async function scrapeTracks(payload) {
  try {
    const response = await fetch(buildApiUrl("/api/scrape"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.warn("Using mock scrape response until backend is wired up.", error);
    return mockScrapeRequest(payload);
  }
}

async function mockDownloadRequest(payload) {
  await new Promise((resolve) => window.setTimeout(resolve, 900));

  return {
    zipUrl: "#mock-download",
    fileName: "scraped_tracks.zip",
    count: payload.urls.length,
  };
}

async function downloadCheckedTracks(payload) {
  try {
    const response = await fetch(buildApiUrl("/api/download"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.warn("Using mock download response until backend is wired up.", error);
    return mockDownloadRequest(payload);
  }
}

export default function ScraperWorkflow() {
  const [trackTitles, setTrackTitles] = useState("");
  const [youtubeApiKey, setYoutubeApiKey] = useState("");
  const [results, setResults] = useState([]);
  const [selectedIndexes, setSelectedIndexes] = useState(new Set());

  const [scrapeStatus, setScrapeStatus] = useState("Waiting for tracks.");
  const [scrapeHasError, setScrapeHasError] = useState(false);

  const [downloadStatus, setDownloadStatus] = useState("No URLs yet.");
  const [downloadHasError, setDownloadHasError] = useState(false);
  const [downloadResult, setDownloadResult] = useState(null);

  const selectedResults = useMemo(() => {
    return Array.from(selectedIndexes)
      .sort((a, b) => a - b)
      .map((index) => results[index])
      .filter(Boolean);
  }, [results, selectedIndexes]);

  const selectionCount = selectedResults.length;

  const handleScrapeSubmit = async (event) => {
    event.preventDefault();
    setDownloadResult(null);

    const tracks = parseTrackTitles(trackTitles);
    const apiKey = youtubeApiKey.trim();

    if (!tracks.length) {
      setScrapeStatus("Add at least one track title first.");
      setScrapeHasError(true);
      return;
    }

    if (!apiKey) {
      setScrapeStatus("Add your YouTube API key first.");
      setScrapeHasError(true);
      return;
    }

    setScrapeStatus("Matching tracks through scrape_tracks.py...");
    setScrapeHasError(false);
    setDownloadStatus("No download job yet.");
    setDownloadHasError(false);

    try {
      const data = await scrapeTracks({ youtubeApiKey: apiKey, tracks });
      const nextResults = Array.isArray(data.results) ? data.results : [];

      setResults(nextResults);
      setSelectedIndexes(new Set(nextResults.map((_, index) => index)));
      setScrapeStatus(`Found ${nextResults.length} YouTube URL matches.`);
    } catch (error) {
      console.error(error);
      setScrapeStatus("Unable to match tracks right now.");
      setScrapeHasError(true);
    }
  };

  const toggleSelection = (index) => {
    setSelectedIndexes((current) => {
      const next = new Set(current);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleDownloadSubmit = async () => {
    if (!selectionCount) {
      setDownloadStatus("Select at least one URL first.");
      setDownloadHasError(true);
      return;
    }

    setDownloadStatus("Submitting approved URLs to open_cnvmp3_page.py...");
    setDownloadHasError(false);

    try {
      const payload = {
        urls: selectedResults.map((item) => item.url),
      };

      const data = await downloadCheckedTracks(payload);
      setDownloadStatus(`Prepared ${data.count || selectionCount} tracks for zip packaging.`);
      setDownloadResult({
        zipUrl: data.zipUrl || "#mock-download",
        fileName: data.fileName || "scraped_tracks.zip",
      });
    } catch (error) {
      console.error(error);
      setDownloadStatus("Unable to queue downloads right now.");
      setDownloadHasError(true);
    }
  };

  return (
    <section className="grid">
      <form className="panel" id="scrape-form" onSubmit={handleScrapeSubmit}>
        <p className="eyebrow">Step 1</p>
        <h2>Match Tracks To YouTube URLs</h2>

        <div className="field">
          <label htmlFor="track-titles">Track titles</label>
          <textarea
            id="track-titles"
            name="trackTitles"
            placeholder={"Track Name\nSong One\nSong Two"}
            value={trackTitles}
            onChange={(event) => setTrackTitles(event.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="youtube-api-key">YouTube API key</label>
          <input
            id="youtube-api-key"
            name="youtubeApiKey"
            type="password"
            placeholder="AIza..."
            autoComplete="off"
            value={youtubeApiKey}
            onChange={(event) => setYoutubeApiKey(event.target.value)}
          />
        </div>

        <div className="button-row">
          <button className="primary" type="submit">Submit Tracks</button>
        </div>
        <p className={`status${scrapeHasError ? " error" : ""}`} id="scrape-status">
          {scrapeStatus}
        </p>
      </form>

      <section className="panel">
        <p className="eyebrow">Step 2</p>
        <h2>Review Matched URLs</h2>
        <span className="badge" id="selection-count">
          {selectionCount} selected
        </span>

        <div className="results" id="results">
          {results.map((item, index) => {
            const checked = selectedIndexes.has(index);
            return (
              <label className="result-row" key={`${item.url}-${index}`}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleSelection(index)}
                />
                <div>
                  <p className="track-title">{item.title}</p>
                  <a className="track-link" href={item.url} target="_blank" rel="noreferrer">
                    {item.url}
                  </a>
                </div>
              </label>
            );
          })}
        </div>

        <div className="button-row">
          <button
            className="primary"
            id="download-submit"
            type="button"
            disabled={selectionCount === 0}
            onClick={handleDownloadSubmit}
          >
            Download Checked Tracks
          </button>
        </div>

        <p className={`status${downloadHasError ? " error" : ""}`} id="download-status">
          {downloadStatus}
        </p>

        {downloadResult ? (
          <div className="download-box" id="download-box">
            <p>
              <strong>Zip ready.</strong> Your backend can return a signed file URL here.
            </p>
            <a
              className="button-link secondary"
              id="download-link"
              href={downloadResult.zipUrl}
              download={downloadResult.fileName}
            >
              Download Zip
            </a>
          </div>
        ) : null}
      </section>
    </section>
  );
}
