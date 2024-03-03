import { Client, Server } from 'node-osc';
import RPC from "discord-rpc";
import fs from 'fs';
import * as DEFAULT_CONFIG from './config-def.json'; //Configの初期設定

//変数定義
const CONFIG_FILE_PATH = './config.json'
let print_conf;

// CONFIGを変数に代入
try {
    print_conf = JSON.parse(fs.readFileSync(CONFIG_FILE_PATH, 'utf-8'));
} catch (conf_Error) {
    fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(DEFAULT_CONFIG.default, null, "  "));
    process.exit(1);
}

// VRChatからのOSCメッセージを受信するサーバーを作成
const vclient = new Client('127.0.0.1', print_conf.VRCHAT_SEND_PORT); // VRChatへメッセージを送るポート
const vserver = new Server(print_conf.VRCHAT_RECEVE_PORT, '0.0.0.0'); // VRChatからのメッセージを待ち受けるポート

// DiscordにRPCメッセージを送信するクライアントを作成
const client = new RPC.Client({ transport: "ipc" }); // Discordにメッセージを送るためのクライアント


//マイクミュート
vserver.on('/avatar/parameters/DisOSC/micmute', async (params) => {
    try {
        // 受信したメッセージの内容をログに出力
        debugprint("Receve　", params[0]," ： ",params[1]);

        // Discordのミュート設定を更新
        await client.setVoiceSettings({
            mute: !!params[1], // = /DisOSC/micmute
        });
    }catch(e){
        // エラーが出た場合エラーログを出力
        console.error("エラー:", e.message);
    }
});

//スピーカーミュート
vserver.on('/avatar/parameters/DisOSC/speakermute', async (params) => {
    try {
        // 受信したメッセージの内容をログに出力
        debugprint("Receve　", params[0], " ： ", params[1]);

        // Discordのミュート設定を更新
        await client.setVoiceSettings({
            deaf: !!params[1], // = /DisOSC/micmute
        });
    } catch (e) {
        // エラーが出た場合エラーログを出力
        console.error("エラー:", e.message);
    }
});


//状態同期
vserver.on('/avatar/parameters/DisOSC/sync', async (params) => {

    if (params[1]) {
        try {
            // 受信したメッセージの内容をログに出力
            debugprint("Receve　", params[0], " ： ", params[1]);

            // Discordのミュート設定を更新
            const getState = await client.getVoiceSettings();

            //現在のDiscordミュート状態を送信
            vclient.send(['/avatar/parameters/DisOSC/micmute', getState.mute]);
            debugprint("Send　", '/avatar/parameters/DisOSC/micmute', " ： ", getState.mute);

            vclient.send(['/avatar/parameters/DisOSC/speakermute', getState.deaf]);
            debugprint("Send　", '/avatar/parameters/DisOSC/speakermute', " ： ", getState.deaf);

        } catch (e) {
            // エラーが出た場合エラーログを出力
            console.error("エラー:", e.message);
        }

    }
});

// Discordにログインする処理
(async () => {
    try {
        // DiscordAppにCONFIG内トークンを使用しOAuth認証を試行
        const auth_result = await client.login({
            clientId: print_conf.DISCORD_CLIENT_ID,
            clientSecret: print_conf.DISCORD_CLIENT_SECRET,
            scopes: ["rpc", "rpc.voice.write"],
            redirectUri: `http://127.0.0.1:${print_conf.DISCORD_PORT}/`,
            accessToken: print_conf.ACCESS_TOKEN,
        });
        
        //認証失敗の場合例外処理
        if (!auth_result.accessToken) {
            throw new Error('Failed authentication with token');
        }

        debugprint("Authentication with token");
        debugprint(auth_result.accessToken);

        //トークンがConfigと違う場合トークンを上書き
        if (auth_result.accessToken !== print_conf.ACCESS_TOKEN) {
            print_conf.ACCESS_TOKEN = auth_result.accessToken;
            fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(print_conf, null, " "));
            debugprint("Reacquire token and store in config.");
        }
        else {
            debugprint("Read Token in config.");
        }

        console.log("Discordにログインしました。VRChatのメニューからミュート状態を同期できます。");
        console.log("終了する際はCtrl+Cを押すか右上のXを押してください。");
    } catch (Terror) {
        debugprint(Terror)
        try {
            // DiscordAppにトークンなしでOAuth認証を試行し戻り値のアクセストークンを変数に代入
            const reauth_result = await client.login({
                clientId: print_conf.DISCORD_CLIENT_ID,
                clientSecret: print_conf.DISCORD_CLIENT_SECRET,
                scopes: ["rpc", "rpc.voice.write"],
                redirectUri: `http://127.0.0.1:${print_conf.DISCORD_PORT}/`,
                accessToken: print_conf.ACCESS_TOKEN,
            });
            debugprint("Authentication without token")

            //configにトークンを上書き
            print_conf.ACCESS_TOKEN = reauth_result.accessToken;
            debugprint(reauth_result.accessToken);
            console.log(print_conf);
            fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(print_conf, null, " "));
            debugprint("Reacquire token and store in config.");

            console.log("Discordにログインしました。VRChatのメニューからミュート状態を同期できます。");
            debugprint("Reacquire token and store in config.");
        } catch (error) {
            // ログインに失敗した場合のエラーログを出力
            console.log("Discordへのログインに失敗しました。configの値を確認してください")
            if (print_conf.DEBUG) {
                console.error("Discord認証エラー:", error.message);
            }
        }
    }
})();

//デバッグ用ログ判別
function debugprint(...opts) {
    if (print_conf.DEBUG) {
        console.log("[Debug] ", ...opts);
    }
}