import { Context, Schema, h, sleep } from "koishi";
import puppeteer from "koishi-plugin-puppeteer";
import { sendMarkdown } from "./messageSend";

export const name = "oni";

export interface Config {
  appId: string;
  token: string;
  api: string;
  mdId: string;
  buttonId: string;
  errorId: string;
  url: string;
  waittime: number;
}

export const Config: Schema<Config> = Schema.object({
  appId: Schema.string(),
  token: Schema.string(),
  api: Schema.string().default(
    "https://oxygennotincluded.fandom.com/zh/api.php"
  ),
  mdId: Schema.string(),
  buttonId: Schema.string(),
  errorId: Schema.string(),
  url: Schema.string().default("https://oni.klei.vip/zh/"),
  waittime: Schema.number().default(5000),
});

export function apply(ctx: Context, config: Config) {
  // write your plugin here
  ctx
    .command("cx <itemName>", "获取wiki详情页")
    .example("cx 电解器")
    .action(async ({ session, options }, itemName = "") => {
      const headers = {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36 Edg/114.0.1823.67",
      };
      const qurry = {
        action: "opensearch",
        namespace: "*",
        limit: 5,
        redirects: "return",
        format: "json",
        search: itemName,
      };
      session.send("本轮查询开始，请等待API返回结果。。");
      await ctx.http
        .get(config.api, { params: qurry, headers: headers })
        .then(async (res) => {
          console.log(res);
          const awserList = [1, 2, 3, 4, 5];
          const [title, resItemList, none1, urlList] = res;
          const itemList = [];
          for (const j in resItemList) {
            itemList.push(resItemList[j].replace(".", "-*"));
          }
          console.log(itemList);
          if (itemName === itemList[0]) {
            return printer(urlList[0]);
          } else {
            let [one, two, three, four, five] = itemList;
            await sendMarkdown(
              config.appId,
              config.token,
              session.channelId,
              config.mdId,
              {
                one: one || "饭炒炒饭",
                two: two || "扬州炒饭",
                three: three || "火腿炒饭",
                four: four || "饭炒鸡蛋",
                five: five || "鸡蛋炒饭",
              },
              config.buttonId
            );
            const awser =
              +(await session.prompt(50 * 1000))
                ?.replace(/\s+/g, "")
                ?.slice(-1) || NaN;
            if (awserList.includes(awser)) {
              return printer(urlList[awser - 1]);
            } else if (Number.isNaN(awser)) {
              session.send("****  选择超时，本轮查询已结束  ****");
              return;
            }
          }
        })
        .catch(async (err) => {
          console.log(err);
          await session.send("API查询失败，赋值截取中，请稍等。。。。");
          await printer(config.url + encodeURI(itemName));
        });
      // 获取截图
      async function printer(url: string) {
        if (url == undefined) {
          session.send("酒吧里不提供此份炒饭。。");
        } else {
          session.send("开始截取，请稍等。。。。");
          const page = await ctx.puppeteer.page();
          try {
            await page.goto(url, {
              timeout: 0,
            });
            let taget = await page.$("#mw-content-text");
            await page.addStyleTag({
              content: "#mw-content-text{padding: 40px}",
            });
            await sleep(config.waittime);
            const img = await taget.screenshot({ type: "jpeg", quality: 65 });
            await page.close();
            session.send(h.image(img, "image/jpeg"));
          } catch (e) {
            await page.close();
            await sendMarkdown(
              config.appId,
              config.token,
              session.channelId,
              config.errorId,
              {
                err: "鬼知道哪里出了问题（",
              }
            );
          }
        }
      }
    });
}
