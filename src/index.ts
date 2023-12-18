import { Context, Schema, h, sleep } from "koishi";
import puppeteer from "koishi-plugin-puppeteer";
import { sendMarkdown } from "./messageSend";
import sharp from "sharp";

export const usage = `<缺氧>游戏的wiki查询插件,返回wiki详情页截图,机器人必须拥有md的模板和发送的权限,依托shit(

  更新日志:

    - 1.0.5 修复了发送的图片地址多了一个/的问题,像是个睿智.

    - 1.0.4 修复了发送的网址多了一个/的问题(
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
  height: number;
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
  height: Schema.number().default(12228).description("截取的图片高度"),
});

export function apply(ctx: Context, config: Config) {
  const logger = ctx.logger("oni");
  const { appId, token, api, mdId, buttonId, url, quality, height } = config;
  ctx
    .command("cx <itemName>", "获取wiki详情页")
    .example("cx 电解器")
    .action(async ({ session }, itemName = "") => {
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
      session.send(`本轮查询开始: ${itemName},请耐心等待结果返回...`);

      await ctx.http
        .get(api, { params: qurry, headers: headers })
        .then(async (res) => {
          logger.info(`API返回结果: ${res}`);
          const awserList = [1, 2, 3, 4, 5];
          const [title, resItemList, , urlList] = res;
          const itemList = [];
          for (const j in resItemList) {
            itemList.push(resItemList[j].replace(".", "-*"));
          }
          if (itemName === itemList[0]) {
            return printer(urlList[0]);
          } else {
            let [one, two, three, four, five] = itemList;
            await sendMarkdown(
              appId,
              token,
              session.channelId,
              mdId,
              {
                one: one || "饭炒炒饭",
                two: two || "扬州炒饭",
                three: three || "火腿炒饭",
                four: four || "饭炒鸡蛋",
                five: five || "鸡蛋炒饭",
              },
              buttonId
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

      // 图片切片
      async function sliceImage(buffer: Buffer, userHeight: number) {
        const { width, height } = await sharp(buffer).metadata();
        if (height < userHeight) {
          logger.info(`${height} , ${userHeight}`);
          await session.send(h.image(buffer, "image/jpeg"));
        } else {
          const slices = Math.ceil(height / userHeight);
          for (let i = 0; i < slices; i++) {
            const startY = i * userHeight;
            const endY = Math.min((i + 1) * userHeight, height);
            const extract = {
              left: 0,
              top: startY,
              width,
              height: endY - startY,
            };
            sleep(1000);
            let img = await sharp(buffer).extract(extract).toBuffer();
            await session.send(h.image(img, "image/jpeg"));
          }
          return;
        }
      }

      // 获取截图
      async function printer(url: string) {
        if (url == undefined) {
          session.send("酒吧里不提供此份炒饭。。");
        } else {
          const page = await ctx.puppeteer.page();
          try {
            await page.goto(url, {
              timeout: 0,
            });
            let taget = await page.$("#mw-content-text");
            await page.addStyleTag({
              content: "#mw-content-text{padding: 40px}",
            });
            sleep(3000);
            const img = await taget.screenshot({
              type: "jpeg",
              quality: quality,
            });
            await page.close();
            logger.info(`截图成功: ${url}`);
            session.send(
              `你也可以自行去访问下列网址查看:\n${
                config.url + encodeURI(itemName)
              }`
            );
            await sliceImage(img, height);
            return;
          } catch (e) {
            await page.close();
            logger.info(`截图失败, 原因: ${e}`);
            session.send("截图失败,请等等再试一次...");
          }
        }
      }
    });
}
