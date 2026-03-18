exports.handler = async function (event) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
    "Cache-Control": "public, max-age=3600",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "GET") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const url = event.queryStringParameters && event.queryStringParameters.url;
  if (!url || !url.includes("bandcamp.com")) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Bandcamp URL required" }) };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    let res;
    try {
      res = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
        },
      });
    } catch (fetchErr) {
      if (fetchErr.name === 'AbortError') {
        return { statusCode: 504, headers, body: JSON.stringify({ error: "Upstream timeout" }) };
      }
      return { statusCode: 502, headers, body: JSON.stringify({ error: "Failed to fetch" }) };
    } finally {
      clearTimeout(timeoutId);
    }

    if (!res.ok) {
      return { statusCode: 502, headers, body: JSON.stringify({ error: "Failed to load Bandcamp page" }) };
    }

    const html = await res.text();

    // Extract og:image (artwork) - may not be present in server-rendered HTML
    const ogImageMatch = html.match(/<meta property="og:image" content="([^"]+)"/);
    let artworkUrl = ogImageMatch ? ogImageMatch[1] : null;

    let embedUrl = null;

    // Method 1: data-tralbum attribute (most common)
    const tralbumMatch = html.match(/data-tralbum="([^"]+)"/);
    if (tralbumMatch) {
      try {
        const tralbum = JSON.parse(tralbumMatch[1].replace(/&quot;/g, '"'));
        const id = tralbum.id;
        const isAlbum = url.includes('/album/');
        const type = isAlbum ? 'album' : 'track';
        const trackParam = isAlbum ? 'track_num=1/' : '';
        embedUrl = `https://bandcamp.com/EmbeddedPlayer/${type}=${id}/size=large/bgcol=111111/linkcol=e8d5a3/artwork=small/${trackParam}transparent=true/`;
      } catch(e) {}
    }

    // Method 2: TralbumData in inline script
    if (!embedUrl) {
      const tralbumDataMatch = html.match(/TralbumData\s*=\s*(\{[\s\S]*?\});\s*\n/);
      if (tralbumDataMatch) {
        try {
          const data = JSON.parse(tralbumDataMatch[1]);
          const id = data.id;
          const isAlbum = url.includes('/album/');
          const type = isAlbum ? 'album' : 'track';
          const trackParam = isAlbum ? 'track_num=1/' : '';
          embedUrl = `https://bandcamp.com/EmbeddedPlayer/${type}=${id}/size=large/bgcol=111111/linkcol=e8d5a3/artwork=small/${trackParam}transparent=true/`;
        } catch(e) {}
      }
    }

    // Method 3: og:video meta tag
    if (!embedUrl) {
      const ogVideoMatch = html.match(/<meta property="og:video" content="([^"]+)"/);
      if (ogVideoMatch) embedUrl = ogVideoMatch[1];
    }

    // Method 4: direct EmbeddedPlayer URL in page source
    if (!embedUrl) {
      const embeddedMatch = html.match(/https:\/\/bandcamp\.com\/EmbeddedPlayer\/(?:album|track)=(\d+)[^"']*/);
      if (embeddedMatch) {
        embedUrl = embeddedMatch[0]
          .replace(/bgcol=[a-fA-F0-9]+/, 'bgcol=111111')
          .replace(/linkcol=[a-fA-F0-9]+/, 'linkcol=e8d5a3');
      }
    }

    // Method 5: numeric ID from meta
    if (!embedUrl) {
      const idFromMeta = html.match(/"id":(\d+),"type":"(?:album|track)"/);
      if (idFromMeta) {
        const isAlbum = url.includes('/album/');
        const type = isAlbum ? 'album' : 'track';
        const trackParam = isAlbum ? 'track_num=1/' : '';
        embedUrl = `https://bandcamp.com/EmbeddedPlayer/${type}=${idFromMeta[1]}/size=large/bgcol=111111/linkcol=e8d5a3/artwork=small/${trackParam}transparent=true/`;
      }
    }

    if (!embedUrl && !artworkUrl) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: "Embed not found — this album may be private or non-embeddable" }) };
    }

    // If no og:image, derive artwork URL from embed ID
    // Bandcamp pattern: https://f4.bcbits.com/img/a{ID}_16.jpg
    if (!artworkUrl && embedUrl) {
      const idMatch = embedUrl.match(/(?:album|track)=(\d+)/);
      if (idMatch) {
        artworkUrl = `https://f4.bcbits.com/img/a${idMatch[1]}_16.jpg`;
      }
    }

    return { statusCode: 200, headers, body: JSON.stringify({ embedUrl, artworkUrl }) };

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};