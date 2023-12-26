export async function sendMarkdown(
  appID: string,
  token: string,
  channelId: string | number,
  templateId: string,
  _params?: { [key: string]: string },
  keyboardId?: string
) {
  const params: { key: string; values: [string] }[] = [];
  for (const key in _params) params.push({ key, values: [_params[key]] });
  return fetch(`https://api.sgroup.qq.com/channels/${channelId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bot ${appID}.${token}`,
    },
    body: JSON.stringify({
      markdown: {
        custom_template_id: templateId,
        params: params,
      },
      keyboard: { id: keyboardId },
    }),
  }).then(async (res) => {
    const json = await res.json();
    if (json.code) {
      console.log(res.headers.get("x-tps-trace-id"));
      throw json;
    } else return json;
  });
}

export async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
