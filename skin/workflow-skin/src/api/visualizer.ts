export async function uploadShotToVisualizer(api: { baseUrl: string }, shot: unknown) {
  const response = await fetch(`${api.baseUrl}/api/v1/plugins/visualizer.reaplugin/upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(shot)
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Visualizer upload failed: ${response.status} ${text}`);
  return text ? JSON.parse(text) : {};
}
