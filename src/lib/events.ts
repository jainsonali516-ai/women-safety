/**
 * Checks for rallies/protests/road closures in Delhi NCR around a given date via NewsAPI.
 * Optional — returns null (no warning) when NEWS_API_KEY isn't configured, so this never
 * blocks the bot's core forecast.
 */
export async function checkForDisruptiveEvents(date: Date) {
  const apiKey = process.env.NEWS_API_KEY;
  if (!apiKey) return null;

  const from = new Date(date);
  from.setDate(from.getDate() - 1);

  const url = new URL("https://newsapi.org/v2/everything");
  url.searchParams.set("q", '(rally OR protest OR "road closure" OR bandh) AND (Delhi OR Gurugram OR Noida OR NCR)');
  url.searchParams.set("from", from.toISOString().slice(0, 10));
  url.searchParams.set("to", date.toISOString().slice(0, 10));
  url.searchParams.set("language", "en");
  url.searchParams.set("sortBy", "relevancy");
  url.searchParams.set("pageSize", "3");
  url.searchParams.set("apiKey", apiKey);

  try {
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json();
    const articles = (data.articles ?? []) as { title: string }[];
    if (articles.length === 0) return null;
    return {
      detected: true as const,
      headline: articles[0].title,
    };
  } catch {
    return null;
  }
}
