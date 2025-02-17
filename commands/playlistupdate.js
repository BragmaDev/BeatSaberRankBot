const Command = require("../core/command/command.js");
const Discord = require("discord.js");
const fetch = require('node-fetch');

class PlaylistUpdate extends Command {
    async run(client, message, args) {
        if (!message.attachments.array()[0]) {
            await message.channel.send("No attachment provided.")
            return;
        }
        const attachmentURL = message.attachments.array()[0].attachment;
        if (attachmentURL.endsWith(".json") || attachmentURL.endsWith(".bplist")) {
            let data;
            try {
                data = await fetch(`${attachmentURL}`).then(res => res.json());
            } catch (err) {
                await message.channel.send("Something went wrong downloading the playlist.")
                console.log(err)
            }

            let mapsUpdated = 0;
            let changelog = "";
            let errored = 0;
            let deleted = 0;
            let duplicate = 0;
            let hashDiffPairs = [];

            try {
                const hashlist = data.songs.map(e => e.hash);
                const maps = await client.beatsaver.bulkFindMapsByHash(hashlist);
                for (let i = 0; i < data.songs.length; i++) {
                    const mapHash = data.songs[i].hash;
                    const map = maps.find(e => e?.versions.find(x => x?.hash === mapHash));

                    if (!map) {
                        errored++;
                        changelog += `${mapHash} could not be found.\n-=-\n`
                        continue;
                    }
                    else if (mapHash !== map?.versions[0].hash) {
                        const oldVerIndex = map.versions.map(e => e.hash).indexOf(mapHash);
                        changelog += `${map.metadata.songAuthorName} - ${map.metadata.songName} by: ${map.metadata.levelAuthorName} \nOld: ${client.misc.formatedDate(map.versions[oldVerIndex].createdAt)} \nNew: ${client.misc.formatedDate(map.versions[0].createdAt)}\n-=-\n`;
                        mapsUpdated++;
                        data.songs[i].levelid = `custom_level_${map.versions[0].hash}`;
                        data.songs[i].hash = map.versions[0].hash;
                    }
                    if (map.deleted === true) {
                        deleted++;
                        changelog += `${map.metadata.songAuthorName} - ${map.metadata.songName} by: ${map.metadata.levelAuthorName} \n!!! DELETED !!!\nUploaded: ${client.misc.formatedDate(map.versions[0].createdAt)}\n-=-\n`;
                        if (args[0] === "clean") {
                            data.songs.splice(i, 1);
                        }
                    }
                    // Messy logic here
                    // Will eventually get moved to a website for better UI options and such
                    // Letting hashDiffIndex remain undefined if we cannot find a difficulty array on the playlist data
                    const hashIndex = hashDiffPairs.findIndex(pair => pair.hash === data.songs[i].hash);
                    let hashDiffIndex;
                    if (data.songs[i].difficulties) {
                        // findIndex throws an error if no difficulties can be found
                        // Also this should probably support multiple difficulties, not just the first one
                        hashDiffIndex = hashDiffPairs.findIndex(pair => pair.hash === data.songs[i].hash && pair.diffs === data.songs[i]?.difficulties[0]?.name);
                    }
                    // Both the indexes needs to be found and since hashDiffIndex is undefined incase it was not found it skips this
                    if (hashDiffIndex === -1 && hashIndex === -1) {
                        hashDiffPairs.push({
                            hash: data.songs[i].hash,
                            diffs: data.songs[i].difficulties[0].name
                        });
                    }
                    else if (hashIndex === -1) {
                        hashDiffPairs.push({
                            hash: data.songs[i].hash
                        });
                    }
                    else {
                        duplicate++;
                        changelog += `${map.metadata.songAuthorName} - ${map.metadata.songName} by: ${map.metadata.levelAuthorName} \nHash: ${mapHash}\n!!! DUPLICATE !!!\n-=-\n`
                        if (args[0] === "clean") {
                            data.songs.splice(i, 1);
                        }
                    }
                }

                const playlistString = JSON.stringify(data, null, 2);
                const playlistBuffer = Buffer.from(playlistString, "utf-8");
                const changelogBuffer = Buffer.from(changelog, "utf-8");
                const changeLogAttachtment = new Discord.MessageAttachment(changelogBuffer, `changelog.txt`);
                const playlistAttachmet = new Discord.MessageAttachment(playlistBuffer, `${data.playlistTitle}.json`);


                let msg = `Updated your playlist.\nUpdated ${mapsUpdated} maps.`
                if (errored > 0) msg += `\nFailed on ${errored} maps.`
                if (deleted > 0) msg += `\nFound ${deleted} deleted maps.`
                if (duplicate > 0) msg += `\nFound ${duplicate} duplicate maps.`
                if ((deleted > 0 || duplicate > 0) && args[0] !== "clean") msg += ` Run this command like this \`${client.config.prefix}playlistupdate clean\` to remove deleted/duplicate maps.`

                let attachmentArray = [playlistAttachmet]
                if (changelog.length !== 0) attachmentArray.push(changeLogAttachtment)

                await message.channel.send(msg, attachmentArray);
            }
            catch (err) {
                await message.channel.send("Failed to update this playlist, make sure it is a correct playlist.")
                console.log(err);
            }

        }
        else {
            await message.channel.send("This is not a valid playlist data type. Supported types: json, bplist")
        }
    }
}
module.exports = PlaylistUpdate;