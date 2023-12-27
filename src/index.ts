import { Context, Logger, Schema, h } from "koishi";
import puppeteer from "koishi-plugin-puppeteer";
import { sendMarkdown, delay } from "./messageSend";
import { PNG } from "pngjs";

export const usage = `<缺氧>游戏的wiki查询插件,返回wiki详情页截图,机器人必须拥有md的模板和发送的权限.自己都看不下去去了,依托shit(

  更新日志:\n
    - 2.0.2 又重新写了一遍图片处理逻辑,顺带把自定义网址加入发送的自定义.
    - 2.0.1 尝试修复频道端无法处理的问题.
    - 2.0.0 重新写了一遍,优化了点逻辑.
    - 1.0.5 修复了发送的图片地址多了一个/的问题,像是个睿智.
`;
export const inject = ["puppeteer"];
export const name = "oni";

export interface Config {
  appId: string;
  token: string;
  api: string;
  mdId: string;
  buttonId: string;
  url: string;
  quality: number;
  maxHeight: number;
}

export const Config: Schema<Config> = Schema.object({
  appId: Schema.string().description("机器人的ID"),
  token: Schema.string().description("机器人的token"),
  api: Schema.string()
    .default("https://oxygennotincluded.fandom.com/zh/api.php")
    .description("wiki的api地址"),
  mdId: Schema.string().description("机器人的mdID"),
  buttonId: Schema.string().description("机器人的按钮Id"),
  url: Schema.string()
    .default("https://klei.vip/oni/cs63ju/")
    .description("请求失败直接赋值的前缀地址"),
  quality: Schema.number().default(60).description("截取的图片质量"),
  maxHeight: Schema.number().default(12228).description("截取的图片高度"),
});

const logger = new Logger("oni");

export function apply(ctx: Context, config: Config) {
  const { appId, token, api, mdId, buttonId, url, quality, maxHeight } = config;
  ctx
    .command("cx <itemName>", "获取wiki详情页")
    .example("cx 电解器")
    .action(async ({ session }, itemName: string = "电解器") => {
      session.send(`您查询的 「${itemName}」 正在进行中...`);
      const awserList: number[] = [1, 2, 3, 4, 5];
      // 向服务器发起搜索
      let res = await ctx.http
        .get(api, {
          headers: {
            "Content-Type": "application/json",
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.149 Safari/537.36",
          },
          params: {
            action: "opensearch",
            search: itemName,
            limit: 5,
            redirects: "return",
            format: "json",
          },
        })
        .then((res) => {
          return [res[1], res[3]];
        })
        .catch((err) => {
          logger.error(err);
          return [];
        });

      let title: string[] = [...res[0]];
      let res_url: string[] = [...res[1]];

      logger.info(`API返回的数据为: ${title}`);

      if (title.length > 0 && title[0] == itemName) {
        const buffer = await screenShot(res_url[0]);
        if (buffer) {
          return splitImage(buffer);
        }
      } else if (title.length > 0 && title[0] != itemName) {
        let [one, two, three, four, five] = title;
        await sendMarkdown(
          appId,
          token,
          session.channelId || session.guildId,
          mdId,
          {
            one: one || "蝴蝶松饼",
            two: two || "波兰水饺",
            three: three || "怪物千层饼",
            four: four || "曼德拉草汤",
            five: five || "火龙果派",
          },
          buttonId
        );
        const awser =
          +(await session.prompt(50 * 1000))?.replace(/\s+/g, "")?.slice(-1) ||
          NaN;
        if (awserList.includes(awser)) {
          const buffer = await screenShot(res_url[awser - 1]);
          if (buffer) {
            return splitImage(buffer);
          }
        } else if (Number.isNaN(awser)) {
          return "选择超时,本轮查询已结束...";
        }
      } else if (res.length == 0) {
        session.send("没有找到相关的结果,尝试赋值截取中...");
        const buffer = await screenShot(url + encodeURI(itemName));
        if (buffer) {
          return splitImage(buffer);
        }
      }

      // 获取截图
      async function screenShot(url: string): Promise<Buffer | void> {
        logger.info(`开始截图: ${url}`);
        if (url == undefined) {
          session.send("酒吧里不提供此份饭炒蛋 ( ");
          return;
        } else {
          const page = await ctx.puppeteer.page();
          await page.goto(url, {
            // waitUntil: "networkidle2",
            timeout: 0,
          });
          await delay(2000);
          const selector = await page.$("#mw-content-text");
          await page.addStyleTag({
            content: "#mw-content-text{padding: 40px}",
          });
          await delay(2000);

          return await selector
            .screenshot({
              type: "png",
            })
            .then(async (buffer: Buffer) => {
              return buffer;
            })
            .catch((err) => {
              logger.error(err);
              return;
            })
            .finally(() => {
              page.close();
            });
        }
      }

      // 图片切片
      async function splitImage(buffer: Buffer) {
        let png = await new Promise<PNG>((resolve, reject) => {
          const png = new PNG();
          return png.parse(buffer, (error, data) => {
            return error ? reject(error) : resolve(data);
          });
        });
        if (png.height > maxHeight) {
          const width = png.width;
          const user_height = maxHeight;
          logger.info(`图片高度${png.height},图片宽度${png.width}`);
          const img = new PNG({ width, height: user_height });
          png.bitblt(img, 0, 0, width, user_height, 0, 0);
          let final = PNG.sync.write(img);

          session.send(
            `若图片异常或无法发出,您可以自行访问以下网址查看详情: \n${url}${encodeURI(
              itemName
            )}`
          );
          return h.image(final, "image/png");
        } else {
          session.send(
            `若图片异常或无法发出,您可以自行访问以下网址查看详情: \n${url}${encodeURI(
              itemName
            )}`
          );
          return h.image(buffer, "image/png");
        }
      }
    });
}
