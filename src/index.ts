import { Context, Logger, Schema, h } from "koishi";
import puppeteer from "koishi-plugin-puppeteer";
import { sendMarkdown, delay } from "./messageSend";
import os from "os";
import * as lib from "./lib";

export const usage = `<缺氧>游戏的wiki查询插件,返回wiki详情页截图,机器人必须拥有md的模板和发送的权限.自己都看不下去去了,依托shit(

  更新日志:\n
    - 2.2.2 修复文件不能有路径的问题
    - 2.2.1 加入本地文件检测.
    - 2.1.1 刷下版本号,商店一直加不了(
    - 2.1.0 将图片保存到服务器,以避免被腾讯煞笔规则搞得发不了大图的问题.
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
  imgPath: string;
  userPath: string;
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
  quality: Schema.number().default(75).description("截取的图片质量"),
  maxHeight: Schema.number().default(12228).description("截取的图片高度"),
  imgPath: Schema.string()
    .default(os.homedir() + "\\Desktop\\wikiImg\\")
    .description("保存到本地的路径"),
  userPath: Schema.string()
    .default("https://oni.wiki/")
    .description("公网地址"),
});

export function apply(ctx: Context, config: Config) {
  const logger = ctx.logger("oni");
  ctx
    .command("cx <itemName>", "获取wiki详情页")
    .option("update", "-u 更新缓存")
    .example("cx 电解器")
    .action(async ({ session, options }, itemName: string = "电解器") => {
      if (options.update) {
        session.send("正在尝试更新缓存...");
        return await toUser();
      }
      session.send(`您查询的 「${itemName}」 正在进行中...`);
      // 判断文件是否在本地且时间不超2天
      let filePath =
        config.imgPath +
        itemName.replace(/\//g, "-").replace(/:/g, "-").replace(/'/g, "-") +
        ".jpeg";
      if (lib.checkFileExists(filePath)) {
        if (lib.getFileModifyTime(filePath)) {
          return await toUser();
        } else {
          return `文件缓存命中.\n截图已存在于下列网址,请点击自行查看: \n ${
            config.userPath
          }${encodeURI(itemName)}.jpeg\n或者自行访问以下网址查看:\n ${
            config.url
          }${encodeURI(itemName)}`;
        }
      } else {
        return await toUser();
      }

      // 发送消息
      async function toUser() {
        let res: string[] = await getFromFandom();
        if (res.length === 0) {
          session.send(`API 查询超时,即将进行赋值截取......`);
          return screenShot(config.url + encodeURI(itemName));
        } else {
          const awserList: number[] = [1, 2, 3, 4, 5];
          let title: string[] = [...res[0]];
          let res_url: string[] = [...res[1]];
          logger.info(`API返回的数据为: ${title}`);
          if (title[0] === itemName) {
            return screenShot(res_url[0]);
          } else {
            let [one, two, three, four, five] = title;
            await sendMarkdown(
              config.appId,
              config.token,
              session.channelId || session.guildId,
              config.mdId,
              {
                one: one || "蝴蝶松饼",
                two: two || "波兰水饺",
                three: three || "怪物千层饼",
                four: four || "曼德拉草汤",
                five: five || "火龙果派",
              },
              config.buttonId
            );
            const awser =
              +(await session.prompt(50 * 1000))
                ?.replace(/\s+/g, "")
                ?.slice(-1) || NaN;
            if (awserList.includes(awser)) {
              return screenShot(res_url[awser - 1]);
            } else if (Number.isNaN(awser)) {
              return "选择超时,本轮查询已结束...";
            }
          }
        }
      }
      // 从wiki获取数据
      async function getFromFandom(): Promise<string[]> {
        return await ctx.http
          .get(config.api, {
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
            logger.info(res);
            return [res[1], res[3]];
          })
          .catch((err) => {
            logger.error(err);
            return [];
          });
      }
      // 获取截图,保存到本地
      async function screenShot(url: string) {
        logger.info(`开始截图: ${url}`);
        if (url == undefined) {
          return "酒吧里不提供此份饭炒蛋 ( ";
        } else {
          const page = await ctx.puppeteer.page();
          await page.goto(url, {
            // waitUntil: "networkidle2",
            timeout: 0,
          });
          // 添加元素框距离
          await page.addStyleTag({
            content: "#mw-content-text{padding: 40px}",
          });
          await delay(2000);
          const selector = await page.$("#mw-content-text");

          await delay(2000);
          await selector
            .screenshot({
              type: "jpeg",
              quality: config.quality,
              path: `${config.imgPath}${itemName
                .replace(/\//g, "-")
                .replace(/:/g, "-")
                .replace(/'/g, "-")}.jpeg`,
            })
            .then(async () => {})
            .catch(async (err) => {
              logger.error(err);
            })
            .finally(async () => {
              await page.close();
            });
          return `截图已保存到下列网址,请点击自行查看: \n ${
            config.userPath
          }${encodeURI(
            itemName.replace(/\//g, "-").replace(/:/g, "-").replace(/'/g, "-")
          )}.jpeg\n或者自行访问以下网址查看:\n ${config.url}${encodeURI(
            itemName
          )}`;
        }
      }
    });
}
