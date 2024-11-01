/**
 * @name PingNotification
 * @author DaddyBoard
 * @version 6.3.1
 * @description A BetterDiscord plugin to show in-app notifications for mentions, DMs, and messages in specific guilds.
 * @website https://github.com/DaddyBoard/PingNotification
 * @source https://raw.githubusercontent.com/DaddyBoard/PingNotification/main/PingNotification.plugin.js
 * @updateUrl https://github.com/DaddyBoard/PingNotification/blob/main/PingNotification.plugin.js
 * @invite ggNWGDV7e2
 */

const { React, Webpack, Patcher, Data, Dispatcher, ReactDOM } = BdApi;


const UserStore = Webpack.getStore("UserStore");
const ChannelStore = Webpack.getStore("ChannelStore");
const GuildChannelsStore = Webpack.getStore("GuildChannelStore");
const GuildStore = Webpack.getStore("GuildStore");
const PermissionStore = BdApi.Webpack.getStore("PermissionStore");
const SortedGuildStore = BdApi.Webpack.getStore("SortedGuildStore");
const SelectedChannelStore = Webpack.getStore("SelectedChannelStore");
const RelationshipStore = Webpack.getStore("RelationshipStore");
const GuildChannelStore = Webpack.getStore("GuildChannelStore");
const transitionTo = Webpack.getByStrings(["transitionTo - Transitioning to"],{searchExports:true});
const MessageParserModule = Webpack.getModule(m => m.defaultRules && m.parse);
const parse = MessageParserModule?.parse;
const defaultRules = MessageParserModule?.defaultRules;
const GuildMemberStore = Webpack.getModule(m => m.getMember);
const ColorConverter = Webpack.getModule(m => m.int2hex);
const getGuildIconURL = BdApi.Webpack.getModule(m => m.getGuildIconURL)?.getGuildIconURL;

module.exports = class PingNotification {

    showChangelog() {
        try {
            const changelogContent = Array.isArray(this.config.changelog) 
                ? this.config.changelog.map((change, index) => {
                    const isNew = index === 0;
                    return `# __v${change.title}__ ${isNew ? '🆕' : ''}\r\n\r\n${change.items.map(item => `• ${item}`).join('\r\n\r\n')}`;
                }).join('\r\n\r\n\r\n')
                : "No changelog available.";

            BdApi.UI.showConfirmationModal(
                "PingNotification Changelog",
                changelogContent,
                {
                    confirmText: "Close",
                    cancelText: null
                }
            );

            console.log("PingNotification: Changelog modal shown");
        } catch (error) {
            console.error("PingNotification: Error showing changelog", error);
        }
    }

    constructor() {
        this.config = {
            info: {
                name: "PingNotification",
                authors: [
                    {
                        name: "DaddyBoard",
                        discord_id: "241334335884492810",
                        github_username: "DaddyBoard",
                    }
                ],
                version: "6.3.1",
                description: "Shows in-app notifications for mentions, DMs, and messages in specific guilds with React components.",
                github: "https://github.com/DaddyBoard/PingNotification",
                github_raw: "https://raw.githubusercontent.com/DaddyBoard/PingNotification/main/PingNotification.plugin.js"
            },
            changelog: [
                {
                    title: "6.3.1",
                    items: [
                        "Added new setting to blur all content from NSFW (age restricted) channels, disabled by default.",
                        "Updated changelog to use BetterDiscord's UI components."
                    ]
                },
                {
                    title: "6.3",
                    items: [
                        "Added proper support for spoilered content (text, images and videos) in notifications",
                        "Privacy mode rework, is now clearer and more intuitive",
                        "Now displays Group DMs as 'Group Chat • {Name}'",
                        "Added support for threads in automatic mode",
                        "Now closes all notifications from the same channel/DM when one is clicked",
                        "Added new setting to color user mentions based on their role color",
                        "Added new 'automatic' mode that follows Discord's notification settings directly"
                    ]
                }
                // {
                //     title: "6.2",
                //     items: [
                //         "Added context menu items for channels, guilds, threads and users so you can easily add/remove them from the ignored lists.",
                //         "Completely rewritten all of the settings menus with a new design.",
                //         "Overhauled the popup theme to be more sleek and modern. Better readability.",
                //         "Completely removed the janky blacklist/whitelist system. Default behavior is now;  **whitelist** servers you want all notifications for, **ignore*specific channels and **ignore*specific users. For more info, check the GitHub README.",
                //         "If you experience any issues, please fully close discord and delete 'pingnotification.**config**.json' from your BetterDiscord/plugins folder. Then restart discord and let the plugin's config reset. This will mean the plugin will revert to default settings, and you'll have to configure it again."
                //     ]
                // },
                // {
                //     title: "v6.1",
                //     items: [
                //         "Added logic to handle forwarded messages gracefully.",
                //     ]
                // },
                // {
                //     title: "v6.0.1",
                //     items: [
                //         "Removed auto-update logic as it is no longer allowed.",
                //     ]
                // },
                // {
                //     title: "v6.0",
                //     items: [
                //         "**Major change:*Moved away from ZeresPluginLibrary to use built-in BdApi.",
                //         "General code improvements and optimizations."
                //     ]
                // },
                // {
                //     title: "v5.4.1",
                //     items: [
                //         "You can now swipe the notification to the left or right to close it, depending on notification location.",
                //         "Added a new setting to show nicknames instead of usernames from the server the message was sent in. *Disabled by default.*",
                //         "Added a new setting to show senders color based on their role from the server the message was sent in. *Disabled by default.*",
                //         "General code improvements and optimizations."
                //     ]
                // }
            ],
            main: "index.js"
        };


        this.defaultSettings = {
                duration: 15000,
                ignoredUsers: [],
                ignoredChannels: [],
                allowedGuilds: {},
                popupLocation: "bottomRight",
                allowNotificationsInCurrentChannel: false,
                privacyMode: false,
                coloredUsernames: true,
                showNicknames: true,
                ignoredThreads: [],
                mode: "automatic",
                colorMentions: true,
                applyNSFWBlur: false
            };
            this.activeNotifications = [];

        this.loadSettings();
        
        const lastVersion = BdApi.getData('PingNotification', 'lastVersion');
        if (lastVersion !== this.config.info.version) {
            this.showChangelog();
            BdApi.setData('PingNotification', 'lastVersion', this.config.info.version);
        }

        this.contextMenuPatches = [];
    }

    getName() { return this.config.info.name; }
    getAuthor() { return this.config.info.authors.map(a => a.name).join(", "); }
    getDescription() { return this.config.info.description; }
    getVersion() { return this.config.info.version; }

    start() {
        this.loadSettings();
        this.patchDispatcher();
        if (this.settings.mode === "manual") {
            this.patchContextMenus();
        }
        BdApi.injectCSS("PingNotificationStyles", this.css);

        console.log("PingNotification started");
    }
    

    stop() {
        BdApi.Patcher.unpatchAll("PingNotification");
        this.removeAllNotifications();
        BdApi.clearCSS("PingNotificationStyles");
        this.unpatchContextMenus();
        console.log("PingNotification stopped");
    }

    loadSettings() {
        this.settings = { ...this.defaultSettings, ...BdApi.Data.load("PingNotification", "settings") };
        console.log("Settings loaded:", this.settings);
    }

    saveSettings() {
        BdApi.Data.save("PingNotification", "settings", this.settings);
        console.log("Settings saved:", this.settings);
    }


    css = `
        .ping-notification {
            position: fixed;
            width: 350px;
            background-color: rgba(30, 31, 34, 0.95);
            color: var(--text-normal);
            border-radius: 12px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2), 0 2px 4px rgba(0, 0, 0, 0.1), 0 0 1px rgba(255, 255, 255, 0.1);
            z-index: 9999;
            overflow: hidden;
            backdrop-filter: blur(10px);
            animation: notificationPop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            transform: translateZ(0);
        }
        .ping-notification.glow {
            animation: notificationPop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275), glowPulse 2s ease-out;
        }
        @keyframes notificationPop {
            0% { transform: scale(0.9) translateZ(0); opacity: 0; }
            100% { transform: scale(1) translateZ(0); opacity: 1; }
        }
        @keyframes glowPulse {
            0% { box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2), 0 2px 4px rgba(0, 0, 0, 0.1), 0 0 1px rgba(255, 255, 255, 0.1); }
            50% { box-shadow: 0 8px 24px rgba(var(--brand-experiment-rgb), 0.4), 0 2px 4px rgba(var(--brand-experiment-rgb), 0.2), 0 0 1px rgba(255, 255, 255, 0.2); }
            100% { box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2), 0 2px 4px rgba(0, 0, 0, 0.1), 0 0 1px rgba(255, 255, 255, 0.1); }
        }
        .ping-notification-content {
            padding: 12px;
            cursor: pointer;
            position: relative;
            color: var(--text-normal);
        }
        .ping-notification-header {
            display: flex;
            align-items: center;
            margin-bottom: 8px;
        }
        .ping-notification-avatar {
            width: 24px;
            height: 24px;
            border-radius: 50%;
            margin-right: 8px;
        }
        .ping-notification-title {
            flex-grow: 1;
            font-weight: bold;
            font-size: 14px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .ping-notification-close {
            cursor: pointer;
            font-size: 18px;
            padding: 0 4px;
        }

        .ping-notification-video-attachment {
            position: relative;
            display: inline-block;
            align-self: center;
        }
        .ping-notification-video-play-button {
            opacity: 0.8;
            transition: opacity 0.2s ease;
        }
        .ping-notification-video-attachment:hover .ping-notification-video-play-button {
            opacity: 1;
        }
        .ping-notification-body {
            font-size: 15px;
            margin-bottom: 8px;
            word-break: break-word;
        }
        .ping-notification-attachment {
            max-width: 100%;
            max-height: 150px;
            border-radius: 4px;
            margin-top: 8px;
        }
        .ping-notification-content.privacy-mode .ping-notification-body,
        .ping-notification-content.privacy-mode .ping-notification-attachment {
            filter: blur(20px);
            transition: filter 0.3s ease;
            position: relative;
        }

        .ping-notification-hover-text {
            position: absolute;
            top: calc(50% + 20px);
            left: 50%;
            transform: translate(-50%, -50%);
            color: var(--text-normal);
            font-size: 14px;
            font-weight: 500;
            pointer-events: none;
            opacity: 1;
            transition: opacity 0.3s ease;
            text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
            white-space: nowrap;
            z-index: 100;
            background-color: rgba(0, 0, 0, 0.7);
            padding: 4px 8px;
            border-radius: 4px;
        }

        .ping-notification-content.privacy-mode:hover .ping-notification-hover-text {
            opacity: 0;
        }

        .ping-notification-content.privacy-mode:hover .ping-notification-body,
        .ping-notification-content.privacy-mode:hover .ping-notification-attachment {
            filter: blur(0);
        }
        .pingNotification-settings {
            padding: 20px;
            color: var(--text-normal);
            font-family: var(--font-primary);
        }

        .pingNotification-title {
            font-size: 24px;
            font-weight: 600;
            margin-bottom: 20px;
        }

        .pingNotification-section {
            background-color: var(--background-secondary);
            border-radius: 10px;
            padding: 20px;
            margin-bottom: 20px;
        }

        .pingNotification-section-title {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 15px;
        }

        .pingNotification-setting {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 0;
        }

        .pingNotification-separator {
            height: 1px;
            background-color: var(--background-modifier-accent);
            margin: 5px 0;
        }

        .pingNotification-label {
            font-size: 14px;
        }

        .pingNotification-switch {
            width: 25.5px;
            height: 15.5px;
            background-color: rgba(255, 77, 77, 0.5);
            border-radius: 7.75px;
            position: relative;
            cursor: pointer;
            transition: background-color 0.3s;
        }

        .pingNotification-switch.checked {
            background-color: rgba(76, 217, 100, 0.5);
        }

        .pingNotification-switch-slider {
            width: 13.5px;
            height: 13.5px;
            background-color: var(--background-primary);
            border-radius: 50%;
            position: absolute;
            top: 1px;
            left: 1px;
            transition: transform 0.3s;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
        }

        .pingNotification-switch.checked .pingNotification-switch-slider {
            transform: translateX(10px);
        }

        .pingNotification-switch::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(255, 77, 77, 0.5);
            border-radius: 7.75px;
            transition: background-color 0.3s;
        }

        .pingNotification-switch.checked::before {
            background-color: rgba(76, 217, 100, 0.5);
        }

        .pingNotification-duration {
            display: flex;
            align-items: center;
        }

        .pingNotification-slider {
            flex-grow: 1;
            margin-right: 10px;
        }

        .pingNotification-duration-input {
            width: 50px;
            text-align: center;
            background-color: var(--background-tertiary);
            border: none;
            border-radius: 5px;
            color: var(--text-normal);
            padding: 5px;
            margin-right: 5px;
        }

        .pingNotification-duration-label {
            font-size: 14px;
        }

        .pingNotification-buttons {
            display: flex;
            justify-content: space-between;
            gap: 10px;
            margin-top: 15px;
        }

        .pingNotification-button {
            flex: 1;
            background-color: var(--background-tertiary);
            color: var(--text-normal);
            border: none;
            border-radius: 8px;
            padding: 10px 15px;
            font-size: 13px;
            cursor: pointer;
            transition: background-color 0.3s, box-shadow 0.3s;
            text-align: center;
            box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
        }

        .pingNotification-button:hover {
            background-color: var(--background-secondary-alt);
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
        }

        .pingNotification-select {
            background-color: var(--background-tertiary);
            color: var(--text-normal);
            border: none;
            border-radius: 5px;
            padding: 5px 10px;
            font-size: 14px;
        }


        .ping-notification .spoilerContent_aa9639,
        .ping-notification .spoilerMarkdownContent_aa9639 {
            background-color: rgba(255, 255, 255, 0.15);
            border-radius: 3px;
            transition: background-color 0.2s ease;
        }

        .ping-notification .spoilerContent_aa9639:hover,
        .ping-notification .spoilerMarkdownContent_aa9639:hover {
            background-color: rgba(255, 255, 255, 0.25);
        }

        .ping-notification-content.privacy-mode .ping-notification-body,
        .ping-notification-content.privacy-mode .ping-notification-attachment-wrapper {
            filter: blur(20px);
            transition: filter 0.3s ease;
            position: relative;
        }

        .ping-notification-content.privacy-mode:hover .ping-notification-body,
        .ping-notification-content.privacy-mode:hover .ping-notification-attachment-wrapper {
            filter: blur(0);
        }
    `;

    patchDispatcher() {
        BdApi.Patcher.after("PingNotification", BdApi.findModuleByProps("dispatch"), "dispatch", (_, [event]) => {
            if (event.type === "MESSAGE_CREATE") {
                this.onMessageReceived(event.message);
            }
        });
    }

    patchContextMenus() {
        this.contextMenuPatches.push(BdApi.ContextMenu.patch("user-context", this.addUserContextMenuItems.bind(this)));
        this.contextMenuPatches.push(BdApi.ContextMenu.patch("guild-context", this.addGuildContextMenuItems.bind(this)));
        this.contextMenuPatches.push(BdApi.ContextMenu.patch("channel-context", this.addChannelContextMenuItems.bind(this)));
        this.contextMenuPatches.push(BdApi.ContextMenu.patch("thread-context", this.addChannelContextMenuItems.bind(this)));
        this.contextMenuPatches.push(BdApi.ContextMenu.patch("gdm-context", this.addChannelContextMenuItems.bind(this)));
    }

    unpatchContextMenus() {
        this.contextMenuPatches.forEach(unpatch => unpatch());
        this.contextMenuPatches = [];
    }

    addUserContextMenuItems(returnValue, props) {
        const userId = props.user.id;
        const isIgnored = this.settings.ignoredUsers.includes(userId);
        const actionText = isIgnored ? "Remove user from ignored list" : "Add user to ignored list";

        const pingNotificationItem = BdApi.ContextMenu.buildItem({
            type: "submenu",
            label: "PingNotification",
            items: [
                {
                    label: actionText,
                    action: () => {
                        this.toggleUserInList(userId);
                    }
                }
            ]
        });

        returnValue.props.children.push(pingNotificationItem);
    }

    addGuildContextMenuItems(returnValue, props) {
        const guildId = props.guild.id;
        const isAllowed = this.settings.allowedGuilds[guildId];
        const actionText = isAllowed ? "Remove guild from allowed list" : "Add guild to allowed list";

        const pingNotificationItem = BdApi.ContextMenu.buildItem({
            type: "submenu",
            label: "PingNotification",
            items: [
                {
                    label: actionText,
                    action: () => {
                        this.toggleGuildInList(guildId);
                    }
                }
            ]
        });

        returnValue.props.children.push(pingNotificationItem);
    }



    addChannelContextMenuItems(returnValue, props) {
        const channel = props.channel;
        if (!channel) return;

        const channelId = channel.id;
        const isThread = channel.isThread && channel.isThread();
        const parentChannelId = channel.parent_id;
        const isGroupDM = channel.type === 3;

        let isIgnored;
        if (isThread) {
            isIgnored = this.settings.ignoredThreads?.some(t => t.id === channelId);
        } else {
            isIgnored = this.settings.ignoredChannels.includes(channelId);
        }

        let actionText;
        if (isThread) {
            actionText = isIgnored ? 'Remove thread from ignored list' : 'Add thread to ignored list';
        } else if (isGroupDM) {
            actionText = isIgnored ? 'Remove group chat from ignored list' : 'Add group chat to ignored list';
        } else {
            actionText = isIgnored ? 'Remove channel from ignored list' : 'Add channel to ignored list';
        }

        const pingNotificationItem = BdApi.ContextMenu.buildItem({
            type: "submenu",
            label: "PingNotification",
            items: [
                {
                    label: actionText,
                    action: () => {
                        if (isThread) {
                            this.toggleThreadInList(channelId, parentChannelId);
                        } else {
                            this.toggleChannelInList(channelId);
                        }
                    }
                }
            ]
        });

        returnValue.props.children.push(pingNotificationItem);
    }

    toggleUserInList(userId) {
        const index = this.settings.ignoredUsers.indexOf(userId);
        if (index === -1) {
            this.settings.ignoredUsers.push(userId);
        } else {
            this.settings.ignoredUsers.splice(index, 1);
        }
        this.saveSettings();
    }

    toggleGuildInList(guildId) {
        this.settings.allowedGuilds[guildId] = !this.settings.allowedGuilds[guildId];
        this.saveSettings();
    }

    toggleChannelInList(channelId) {
        const index = this.settings.ignoredChannels.indexOf(channelId);
        if (index === -1) {
            this.settings.ignoredChannels.push(channelId);
        } else {
            this.settings.ignoredChannels.splice(index, 1);
        }
        this.saveSettings();
    }

    toggleThreadInList(threadId, parentChannelId) {
        if (!this.settings.ignoredThreads) {
            this.settings.ignoredThreads = [];
        }
        const index = this.settings.ignoredThreads.findIndex(t => t.id === threadId);
        if (index === -1) {
            this.settings.ignoredThreads.push({ id: threadId, parentId: parentChannelId });
        } else {
            this.settings.ignoredThreads.splice(index, 1);
        }
        this.saveSettings();
    }

    onMessageReceived(message) {
        const channel = ChannelStore.getChannel(message.channel_id);
        const currentUser = UserStore.getCurrentUser();
    
        if (!channel || message.author.id === currentUser.id) return;
    
        const isForwardedMessage = (message.flags & 16384) === 16384;
    
        if (this.shouldNotify(message, channel)) {
            this.showNotification(message, channel, isForwardedMessage);
        }
    }

    shouldNotify(message, channel) {
        const currentUser = UserStore.getCurrentUser();
        const UserGuildSettingsStore = BdApi.Webpack.getStore("UserGuildSettingsStore");

        if (!this.settings.allowNotificationsInCurrentChannel && channel.id === SelectedChannelStore.getChannelId()) {
            return false;
        }

        if (message.author.id === currentUser.id) return false;
        if (message.flags && (message.flags & 64) === 64) return false;

        if (this.settings.mode === "automatic") {
            if (!channel.guild_id) {
                const isGroupDMMuted = UserGuildSettingsStore.isChannelMuted(null, channel.id);
                const isUserBlocked = RelationshipStore.isBlocked(message.author.id);
                return !isGroupDMMuted && !isUserBlocked;
            }

            if (UserGuildSettingsStore.isGuildOrCategoryOrChannelMuted(channel.guild_id, channel.id)) {
                return false;
            }

            const channelOverride = UserGuildSettingsStore.getChannelMessageNotifications(channel.guild_id, channel.id);
            const guildDefault = UserGuildSettingsStore.getMessageNotifications(channel.guild_id);

            const finalSetting = channelOverride === 3 ? guildDefault : channelOverride;

            const isDirectlyMentioned = message.mentions?.some(mention => mention.id === currentUser.id);
            const isEveryoneMentioned = message.mention_everyone && 
                !UserGuildSettingsStore.isSuppressEveryoneEnabled(channel.guild_id);

            let isRoleMentioned = false;
            if (message.mention_roles?.length > 0 && !UserGuildSettingsStore.isSuppressRolesEnabled(channel.guild_id)) {
                const member = GuildMemberStore.getMember(channel.guild_id, currentUser.id);
                if (member && member.roles) {
                    isRoleMentioned = message.mention_roles.some(roleId => member.roles.includes(roleId));
                }
            }

            const isMentioned = isDirectlyMentioned || isEveryoneMentioned || isRoleMentioned;

            switch (finalSetting) {
                case 0: return true;
                case 1: return isMentioned;
                case 2: return false;
                default: return false;
            }
        } else {
            const isMention = message.mentions.some(mention => mention.id === currentUser.id) || message.mention_everyone;
            const isUserIgnored = this.settings.ignoredUsers.includes(message.author.id);
            const isChannelIgnored = this.settings.ignoredChannels.includes(channel.id);
            const isGuildAllowed = channel.guild_id ? (this.settings.allowedGuilds[channel.guild_id] || false) : true;

            if (message.mention_roles.length > 0) {
                const guildMember = GuildMemberStore.getMember(channel.guild_id, currentUser.id);
                if (guildMember && guildMember.roles) {
                    const isRoleMentioned = message.mention_roles.some(roleId => guildMember.roles.includes(roleId));
                    if (isRoleMentioned) return true;
                }
            }

            if (channel.isThread && channel.isThread()) {
                const ignoredThread = this.settings.ignoredThreads?.find(t => t.id === channel.id);
                if (ignoredThread) {
                    return false;
                }
            }

            if (!channel.guild_id) {
                return !isUserIgnored && !isChannelIgnored;
            }

            return (isMention || isGuildAllowed) && !isUserIgnored && !isChannelIgnored;
        }
    }

    isChannelIgnored(channel) {
        if (this.settings.ignoredChannels.includes(channel.id)) {
            return true;
        }
        
        if (channel.type === 11 || channel.type === 12) {
            const parentChannel = ChannelStore.getChannel(channel.parent_id);
            if (parentChannel && this.settings.ignoredChannels.includes(parentChannel.id)) {
                return true;
            }
        }
        
                    return false;
                }

    

    showNotification(message, channel, isForwardedMessage) {
        console.log("Creating notification element");
        const notificationElement = document.createElement('div');
        notificationElement.className = 'ping-notification glow';
        notificationElement.creationTime = Date.now();
        notificationElement.channelId = channel.id;
        document.body.appendChild(notificationElement);

        ReactDOM.render(
            React.createElement(NotificationComponent, {
                message: message,
                channel: channel,
                settings: this.settings,
                isForwardedMessage: isForwardedMessage,
                onClose: () => this.removeNotification(notificationElement),
                onClick: () => {
                    this.onNotificationClick(channel, message);
                    this.removeNotification(notificationElement);
                },
                onImageLoad: () => {
                    this.adjustNotificationPositions();
                },
                onSwipe: (direction) => {
                    const isRightSwipe = direction === 'right';
                    const isLeftSwipe = direction === 'left';
                    const isRightLocation = this.settings.popupLocation.endsWith("Right");
                    const isLeftLocation = this.settings.popupLocation.endsWith("Left");

                    if ((isRightSwipe && isRightLocation) || (isLeftSwipe && isLeftLocation)) {
                        this.removeNotification(notificationElement);
                    }
                }
            }),
            notificationElement
        );

        this.activeNotifications.push(notificationElement);
        this.adjustNotificationPositions();

        return notificationElement;
    }

    removeNotification(notificationElement) {
        if (document.body.contains(notificationElement)) {
            ReactDOM.unmountComponentAtNode(notificationElement);
            document.body.removeChild(notificationElement);
            this.activeNotifications = this.activeNotifications.filter(n => n !== notificationElement);
            this.adjustNotificationPositions();
        }
    }

    removeAllNotifications() {
        this.activeNotifications.forEach(notification => {
            if (document.body.contains(notification)) {
                ReactDOM.unmountComponentAtNode(notification);
                document.body.removeChild(notification);
            }
        });
        this.activeNotifications = [];
    }

    adjustNotificationPositions() {
        const { popupLocation } = this.settings;
        let offset = 20;
        const isTop = popupLocation.startsWith("top");
        const isLeft = popupLocation.endsWith("Left");

        const sortedNotifications = [...this.activeNotifications].sort((a, b) => {
            return b.creationTime - a.creationTime;
        });

        sortedNotifications.forEach((notification) => {
            const height = notification.offsetHeight;
            notification.style.transition = 'all 0.3s ease-in-out';
            notification.style.position = 'fixed';

            if (isTop) {
                notification.style.top = `${offset}px`;
                notification.style.bottom = 'auto';
            } else {
                notification.style.bottom = `${offset}px`;
                notification.style.top = 'auto';
            }

            if (isLeft) {
                notification.style.left = '20px';
                notification.style.right = 'auto';
            } else {
                notification.style.right = '20px';
                notification.style.left = 'auto';
            }

            offset += height + 10;
        });
    }

    onNotificationClick(channel, message) {
        const notificationsToRemove = this.activeNotifications.filter(notification => 
            notification.channelId === channel.id
        );
        
        notificationsToRemove.forEach(notification => {
            this.removeNotification(notification);
        });

        transitionTo(`/channels/${channel.guild_id || "@me"}/${channel.id}/${message.id}`);
    }

    getSettingsPanel() {
        return BdApi.React.createElement(SettingsPanel, {
            settings: this.settings,
            onSettingsChange: (newSettings) => {
                if (newSettings.mode !== this.settings.mode) {
                    if (newSettings.mode === "manual") {
                        this.unpatchContextMenus();
                        this.patchContextMenus();
                    } else {
                        this.unpatchContextMenus();
                    }
                }

                this.settings = newSettings;
                this.saveSettings();
                this.adjustNotificationPositions();
            }
        });
    }
}

    function NotificationComponent({ message, channel, settings, isForwardedMessage, onClose, onClick, onImageLoad, onSwipe }) {
        const [remainingTime, setRemainingTime] = React.useState(settings.duration);
        const [isPaused, setIsPaused] = React.useState(false);
        const [isGlowing, setIsGlowing] = React.useState(true);

        React.useEffect(() => {
            let interval;
            if (!isPaused) {
                interval = setInterval(() => {
                    setRemainingTime(prev => {
                        if (prev <= 100) {
                            clearInterval(interval);
                            onClose();
                            return 0;
                        }
                        return prev - 100;
                    });
                }, 100);
            }
            return () => clearInterval(interval);
        }, [isPaused, onClose, settings.duration]);

        React.useEffect(() => {
            const glowTimer = setTimeout(() => {
                setIsGlowing(false);
            }, 3000);
            return () => clearTimeout(glowTimer);
        }, []);

        const hexToRGB = (hex) => {
            hex = hex.replace('#', '');
            if (hex.length === 3) {
                hex = hex.split('').map(char => char + char).join('');
            }
            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);
            return [r, g, b];
        };

        React.useEffect(() => {
            if (!settings.colorMentions) return;

            const mentionElements = document.querySelectorAll('.ping-notification .mention');
            const messageMentions = [...(message.mentions || [])];
            const currentUser = BdApi.Webpack.getStore("UserStore").getCurrentUser();
            
            if (message.mentions_everyone || message.mention_everyone || 
                message.mentions?.some(m => m.id === currentUser.id)) {
                if (!messageMentions.find(m => m.id === currentUser.id)) {
                    messageMentions.push(currentUser);
                }
            }

            mentionElements.forEach((mention) => {
                if (mention.className.includes('role') || mention.className.includes('command')) return;
                if (mention._colorInitialized) return;

                const mentionText = mention.textContent.replace('@', '');

                const mentionedUser = messageMentions.find(user => [
                    user.username === mentionText,
                    user.globalName === mentionText,
                    user.id === currentUser.id && mentionText === currentUser.username,
                    user.id === currentUser.id && mentionText === currentUser.globalName
                ].some(match => match));

                if (!mentionedUser) return;

                const member = BdApi.Webpack.getStore("GuildMemberStore").getMember(channel.guild_id, mentionedUser.id);
                const color = member?.colorString;
                mention._storedColor = color;
                mention._colorInitialized = true;

                const handleMouseEnter = () => {
                    mention.style.setProperty(
                        "background-color", 
                        color ? 
                            `rgba(${hexToRGB(color).join(", ")}, 0.3)` :
                            'rgba(88, 101, 242, 0.3)', 
                        "important"
                    );
                };

                const handleMouseLeave = () => {
                    mention.style.setProperty(
                        "background-color", 
                        color ? 
                            `rgba(${hexToRGB(color).join(", ")}, 0.1)` :
                            'rgba(88, 101, 242, 0.15)', 
                        "important"
                    );
                };

                if (color) {
                    mention.style.setProperty("color", color, "important");
                    mention.style.setProperty(
                        "background-color", 
                        `rgba(${hexToRGB(color).join(", ")}, 0.1)`, 
                        "important"
                    );
                } else {
                    mention.style.removeProperty("color");
                    mention.style.removeProperty("background-color");
                }

                mention.addEventListener("mouseenter", handleMouseEnter);
                mention.addEventListener("mouseleave", handleMouseLeave);

                mention._pingNotificationHandlers = {
                    enter: handleMouseEnter,
                    leave: handleMouseLeave
                };
            });

            return () => {
                mentionElements.forEach(mention => {
                    if (mention._pingNotificationHandlers) {
                        mention.removeEventListener("mouseenter", mention._pingNotificationHandlers.enter);
                        mention.removeEventListener("mouseleave", mention._pingNotificationHandlers.leave);
                        delete mention._pingNotificationHandlers;
                    }
                });
            };
        }, []);

        const progress = (remainingTime / settings.duration) * 100;

        const getNotificationTitle = () => {
            let title = '';
            const isNSFW = channel.nsfw || channel.nsfw_;
            
            if (channel.guild_id) {
                const guild = GuildStore.getGuild(channel.guild_id);
                if (guild && guild.name) {
                    title = `${guild.name} • #${channel.name}`;
                } else {
                    title = `Unknown Server • #${channel.name}`;
                }
            } else if (channel.type === 3) {
                const recipients = channel.recipients?.map(id => UserStore.getUser(id)).filter(u => u);
                const name = channel.name || recipients?.map(u => u.username).join(', ');
                title = `Group Chat • ${name}`;
            } else {
                title = `Direct Message`;
            }

            if (isNSFW && settings.applyNSFWBlur) {
                title += ' • ';
                return React.createElement('div', { style: { display: 'flex', alignItems: 'center' } },
                    title,
                    React.createElement('span', {
                        style: {
                            color: 'rgb(240, 71, 71)',
                            fontWeight: 'bold',
                            marginLeft: '4px'
                        }
                    }, 'NSFW')
                );
            }
            
            return title;
        };

        const getAvatarUrl = () => {
            return message.author.avatar
                ? `https://cdn.discordapp.com/avatars/${message.author.id}/${message.author.avatar}.png?size=128`
                : `https://cdn.discordapp.com/embed/avatars/${parseInt(message.author.discriminator) % 5}.png`;
        };

        const getRoleColor = () => {
            if (!message.guild_id) {
                return null;
            }

            const guild = GuildStore.getGuild(message.guild_id);
            if (!guild) {
                return null;
            }

            const member = GuildMemberStore.getMember(message.guild_id, message.author.id);

            if (!member || !member.roles) {
                return null;
            }

            const getRoles = Webpack.getModule(m => m.getRole);
            const guildRoles = getRoles.getRoles(guild.id);

            if (!guildRoles) {
                return null;
            }

            const roles = member.roles
                .map(roleId => guildRoles[roleId])
                .filter(role => role && typeof role.color === 'number' && role.color !== 0);

            if (roles.length === 0) return null;

            const colorRole = roles.sort((a, b) => (b.position || 0) - (a.position || 0))[0];
            return colorRole ? `#${colorRole.color.toString(16).padStart(6, '0')}` : null;
        };


        const roleColor = React.useMemo(() => getRoleColor(), [message.guild_id, message.author.id]);


        const getEmbedContent = (embed) => {
            let content = [];
            if (embed.title) content.push(`**${embed.title}**`);
            if (embed.description) content.push(embed.description);
            if (embed.fields) {
                embed.fields.forEach(field => {
                    content.push(`**${field.name}:** ${field.value}`);
                });
            }
            if (embed.footer) content.push(`_${embed.footer.text}_`);
            return content.join('\n');
        };

        const renderAttachment = (attachment) => {
            const isSpoiler = attachment.spoiler || attachment.filename.startsWith('SPOILER_');
            const commonStyles = {
                maxWidth: '100%',
                maxHeight: '150px',
                borderRadius: '4px',
                marginTop: '8px',
                filter: isSpoiler ? 'blur(30px)' : 'none',
                transition: 'filter 0.2s ease'
            };

            const handleSpoilerClick = (e) => {
                if (isSpoiler) {
                    e.stopPropagation();
                    const container = e.currentTarget;
                    const image = container.querySelector('img');
                    const spoilerText = container.querySelector('.ping-notification-spoiler-text');
                    if (image) image.style.filter = 'none';
                    if (spoilerText) spoilerText.style.opacity = '0';
                }
            };

            const renderSpoilerText = () => {
                return React.createElement('div', {
                    className: 'ping-notification-spoiler-text',
                    style: {
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-normal)',
                        backgroundColor: 'rgba(0, 0, 0, 0.3)',
                        borderRadius: '4px',
                        fontWeight: '600',
                        fontSize: '14px',
                        pointerEvents: 'none',
                        opacity: '1',
                        transition: 'opacity 0.2s ease',
                        zIndex: 1
                    }
                }, 
                    React.createElement('span', {
                        style: {
                            backgroundColor: 'rgba(0, 0, 0, 0.6)',
                            padding: '4px 8px',
                            borderRadius: '4px',
                        }
                    }, 'SPOILER')
                );
            };

            const preventDrag = (e) => {
                e.preventDefault();
            };

            const attachmentContent = attachment.content_type.startsWith('image/') ?
                React.createElement('div', {
                    style: {
                        position: 'relative',
                        display: 'inline-block',
                        cursor: isSpoiler ? 'pointer' : 'default'
                    },
                    onClick: handleSpoilerClick,
                    onDragStart: preventDrag
                },
                    React.createElement('img', { 
                        src: attachment.url, 
                        alt: "Attachment", 
                        className: "ping-notification-attachment",
                        style: commonStyles,
                        onLoad: onImageLoad,
                        draggable: false,
                        onDragStart: preventDrag
                    }),
                    isSpoiler && renderSpoilerText()
                ) :
                attachment.content_type.startsWith('video/') ?
                React.createElement('div', { 
                    className: "ping-notification-video-attachment",
                    style: { 
                        position: 'relative', 
                        display: 'inline-block', 
                        alignSelf: 'center',
                        cursor: isSpoiler ? 'pointer' : 'default'
                    },
                    onClick: handleSpoilerClick,
                    onDragStart: preventDrag
                },
                    React.createElement('img', {
                        src: attachment.proxy_url + '?format=jpeg',
                        alt: "Video Thumbnail",
                        className: "ping-notification-attachment",
                        style: commonStyles,
                        onLoad: onImageLoad,
                        draggable: false,
                        onDragStart: preventDrag
                    }),
                    React.createElement('div', {
                        className: "ping-notification-video-play-button",
                        style: {
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: '48px',
                            height: '48px',
                            backgroundColor: 'rgba(0, 0, 0, 0.7)',
                            borderRadius: '50%',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            filter: isSpoiler ? 'blur(30px)' : 'none',
                            transition: 'filter 0.2s ease',
                            zIndex: 0
                        }
                    },
                        React.createElement('div', {
                            style: {
                                width: '0',
                                height: '0',
                                borderTop: '10px solid transparent',
                                borderBottom: '10px solid transparent',
                                borderLeft: '20px solid white',
                                marginLeft: '4px'
                            }
                        })
                    ),
                    isSpoiler && renderSpoilerText()
                ) : null;

            return React.createElement('div', {
                className: 'ping-notification-attachment-wrapper',
                style: {
                    position: 'relative',
                    display: 'inline-block'
                }
            }, attachmentContent);
        };

        const truncateMessage = (content, embedContent) => {
            const totalLength = content.length + (embedContent ? embedContent.length : 0);
            if (totalLength > 380) {
                const contentLimit = Math.max(100, 380 - (embedContent ? embedContent.length : 0));
                return content.substring(0, contentLimit) + (content.length > contentLimit ? "..." : "");
            }
            return content;
        };

        const getMessageContent = () => {
            let content = '';
            let embedContent = '';

            if (isForwardedMessage) {
                if (message.message_snapshots && message.message_snapshots.length > 0) {
                    const snapshot = message.message_snapshots[0];
                    content = snapshot.message?.content || '';
                    
                    if (snapshot.message?.embeds && snapshot.message.embeds.length > 0) {
                        embedContent = snapshot.message.embeds.map(embed => getEmbedContent(embed)).join('\n\n');
                    }
                } else {
                    content = 'Unable to retrieve forwarded message content';
                }
            } else {
                content = message.content || '';
                if (message.embeds && message.embeds.length > 0) {
                    embedContent = message.embeds.map(embed => getEmbedContent(embed)).join('\n\n');
                }
            }

            if (embedContent) {
                embedContent = `\n\n${embedContent}`;
            }

            const finalContent = truncateMessage(content, embedContent) + embedContent;
            return finalContent;
        };

        const getProgressColor = () => {
            const green = [67, 181, 129];
            const orange = [250, 166, 26];
            const red = [240, 71, 71];

            let color;
            if (progress > 66) {
                color = interpolateColor(orange, green, (progress - 66) / 34);
            } else if (progress > 33) {
                color = interpolateColor(red, orange, (progress - 33) / 33);
            } else {
                color = red;
            }

            return color;
        };

        const interpolateColor = (color1, color2, factor) => {
            return color1.map((channel, index) => 
                Math.round(channel + (color2[index] - channel) * factor)
            );
        };

        const progressColor = getProgressColor();
        const progressColorString = `rgb(${progressColor[0]}, ${progressColor[1]}, ${progressColor[2]})`;

        const getDisplayName = () => {
            if (settings.showNicknames && channel.guild_id) {
                const guild = GuildStore.getGuild(channel.guild_id);
                if (guild) {
                    const member = GuildMemberStore.getMember(guild.id, message.author.id);
                    if (member && member.nick) {
                        return member.nick;
                    }
                }
            }
            return message.author.username;
        };

        const handleSwipe = (e) => {
            const startX = e.touches ? e.touches[0].clientX : e.clientX;
            const handleMove = (moveEvent) => {
                const currentX = moveEvent.touches ? moveEvent.touches[0].clientX : moveEvent.clientX;
                const deltaX = currentX - startX;
                const threshold = 100;

                if (Math.abs(deltaX) > threshold) {
                    onSwipe(deltaX > 0 ? 'right' : 'left');
                    document.removeEventListener('mousemove', handleMove);
                    document.removeEventListener('mouseup', handleEnd);
                    document.removeEventListener('touchmove', handleMove);
                    document.removeEventListener('touchend', handleEnd);
                }
            };

            const handleEnd = () => {
                document.removeEventListener('mousemove', handleMove);
                document.removeEventListener('mouseup', handleEnd);
                document.removeEventListener('touchmove', handleMove);
                document.removeEventListener('touchend', handleEnd);
            };

            document.addEventListener('mousemove', handleMove);
            document.addEventListener('mouseup', handleEnd);
            document.addEventListener('touchmove', handleMove);
            document.addEventListener('touchend', handleEnd);
        };

        const ForwardedIcon = React.memo(() => (
            React.createElement('svg', {
                className: "headerIcon_f66b8e",
                'aria-hidden': "true",
                role: "img",
                xmlns: "http://www.w3.org/2000/svg",
                width: "16",
                height: "16",
                fill: "none",
                viewBox: "0 0 24 24",
                style: {
                    marginRight: '5px',
                    verticalAlign: 'middle'
                }
            },
                React.createElement('path', {
                    fill: "var(--text-low-contrast)",
                    d: "M21.7 7.3a1 1 0 0 1 0 1.4l-5 5a1 1 0 0 1-1.4-1.4L18.58 9H13a7 7 0 0 0-7 7v4a1 1 0 1 1-2 0v-4a9 9 0 0 1 9-9h5.59l-3.3-3.3a1 1 0 0 1 1.42-1.4l5 5Z"
                })
            )
        ));

        return React.createElement('div', {
            className: `ping-notification-content ${isGlowing ? 'glow' : ''} ${
                settings.privacyMode || (settings.applyNSFWBlur && (channel.nsfw || channel.nsfw_)) 
                ? 'privacy-mode' 
                : ''
            }`,
            onClick: onClick,
            onMouseEnter: () => setIsPaused(true),
            onMouseLeave: () => setIsPaused(false),
            onMouseDown: handleSwipe,
            onTouchStart: handleSwipe,
            style: { 
                position: 'relative', 
                overflow: 'hidden', 
                padding: '16px', 
                paddingBottom: '24px',
                minHeight: '80px',
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: 'rgba(30, 31, 34, 0.95)',
                backdropFilter: 'blur(10px)',
                borderRadius: '12px',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2), 0 2px 4px rgba(0, 0, 0, 0.1), 0 0 1px rgba(255, 255, 255, 0.1)',
                transform: 'translateZ(0)',
                transition: 'all 0.3s ease',
            }
        },
            React.createElement('div', { className: "ping-notification-header" },
                React.createElement('img', { 
                    src: getAvatarUrl(), 
                    alt: "Avatar", 
                    className: "ping-notification-avatar",
                    style: {
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        border: '2px solid var(--brand-experiment)',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                    }
                }),
                React.createElement('div', { 
                    className: "ping-notification-title",
                    style: { 
                        display: 'flex', 
                        flexDirection: 'column',
                        marginLeft: '12px'
                    }
                },
                    React.createElement('span', {
                        style: {
                            fontSize: '16px',
                            fontWeight: 'bold',
                            color: settings.coloredUsernames && roleColor ? roleColor : 'var(--header-primary)',
                            marginBottom: '2px'
                        }
                    }, getDisplayName()),
                    React.createElement('span', {
                        style: {
                            fontSize: '12px',
                            color: 'var(--text-muted)'
                        }
                    }, getNotificationTitle())
                ),
                (settings.privacyMode || (settings.applyNSFWBlur && (channel.nsfw || channel.nsfw_))) && 
                React.createElement('div', {
                    className: 'ping-notification-hover-text'
                }, "Hover to unblur")
            ),
            React.createElement('div', { 
                className: "ping-notification-body",
                style: { 
                    flex: 1, 
                    marginTop: '12px',
                    marginBottom: '8px',
                    fontStyle: isForwardedMessage ? 'italic' : 'normal',
                    fontSize: '14px',
                    lineHeight: '1.4'
                }
            },
                isForwardedMessage && React.createElement(ForwardedIcon),
                parse(getMessageContent(), {
                    channelId: channel.id,
                    allowLinks: true,
                    allowMarkdown: true,
                    rules: defaultRules,
                    renderSpoilers: true
                })
            ),
            message.attachments && message.attachments.length > 0 && 
                renderAttachment(message.attachments[0]),
            React.createElement('div', { 
                style: { 
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    height: '4px',
                    width: '100%',
                    backgroundColor: 'rgba(0, 0, 0, 0.2)',
                }
            }),
            React.createElement('div', { 
                style: { 
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    height: '4px',
                    width: `${progress}%`,
                    backgroundColor: progressColorString,
                    transition: 'width 0.1s linear, background-color 0.5s ease',
                    zIndex: 1,
                }
            }),
            React.createElement('div', {
                style: {
                    position: 'absolute',
                    bottom: '8px',
                    right: '12px',
                    fontSize: '12px',
                    color: progressColorString,
                    transition: 'color 0.5s ease',
                    fontWeight: 'bold',
                    backgroundColor: 'rgba(0, 0, 0, 0.4)',
                    padding: '2px 6px',
                    borderRadius: '10px'
                }
            }, `${Math.round(remainingTime / 1000)}s`),
            settings.privacyMode && React.createElement('div', {
                className: 'ping-notification-hover-text'
            }, "Hover to unblur")
        );
    }

    function SettingsPanel({ settings, onSettingsChange }) {
        const [localSettings, setLocalSettings] = React.useState(settings);

        const handleChange = (key, value) => {
            const newSettings = { ...localSettings, [key]: value };

            setLocalSettings(newSettings);
            onSettingsChange(newSettings);
        };

        const openModal = (type) => {
            const modalComponents = {
                guild: GuildSelectionModal,
                channel: ChannelSelectionModal,
                user: UserSelectionModal
            };
            const ModalComponent = modalComponents[type];
            let tempSettings = {...localSettings};
            
            let currentItems;
            if (type === 'guild') {
                currentItems = tempSettings.allowedGuilds || {};
            } else if (type === 'channel') {
                currentItems = tempSettings.ignoredChannels || [];
            } else if (type === 'user') {
                currentItems = tempSettings.ignoredUsers || [];
            }

            BdApi.showConfirmationModal(
                `Edit ${type.charAt(0).toUpperCase() + type.slice(1)}s`,
                React.createElement(ModalComponent, {
                    current: currentItems,
                    onSave: (newItems) => {
                        if (type === 'guild') {
                            tempSettings.allowedGuilds = newItems;
                        } else if (type === 'channel') {
                            tempSettings.ignoredChannels = newItems;
                        } else if (type === 'user') {
                            tempSettings.ignoredUsers = newItems;
                        }
                    }
                }),
                {
                    confirmText: "Save",
                    cancelText: "Cancel",
                    onConfirm: () => {
                        setLocalSettings(tempSettings);
                        onSettingsChange(tempSettings);
                    }
                }
            );
        };

        const Switch = ({ label, checked, onChange }) => (
            React.createElement('div', { className: 'pingNotification-setting' },
                React.createElement('label', { className: 'pingNotification-label' }, label),
                React.createElement('div', { 
                    className: `pingNotification-switch ${checked ? 'checked' : ''}`,
                    onClick: () => onChange(!checked)
                },
                    React.createElement('div', { className: 'pingNotification-switch-slider' })
                )
            )
        );

        return React.createElement('div', { className: 'pingNotification-settings' },
            React.createElement('div', { className: 'pingNotification-section' },
                React.createElement('h3', { className: 'pingNotification-section-title' }, "General Settings"),

                React.createElement('div', { className: 'pingNotification-setting' },
                    React.createElement('label', { className: 'pingNotification-label' }, "Notification Mode"),
                    React.createElement('select', {
                        value: localSettings.mode,
                        onChange: (e) => handleChange('mode', e.target.value),
                        className: 'pingNotification-select'
                    },
                        React.createElement('option', { value: "automatic" }, "Automatic (Use Discord's settings)"),
                        React.createElement('option', { value: "manual" }, "Manual (Use allowed/ignored lists)")
                    )
                ),

                React.createElement('div', { className: 'pingNotification-setting' },
                    React.createElement('label', { className: 'pingNotification-label' }, "Notification Duration"),
                    React.createElement('div', { className: 'pingNotification-duration' },
                        React.createElement('input', {
                            type: 'range',
                            min: 1,
                            max: 60,
                            value: localSettings.duration / 1000,
                            onChange: (e) => handleChange('duration', e.target.value * 1000),
                            className: 'pingNotification-slider'
                        }),
                        React.createElement('input', {
                            type: 'number',
                            min: 1,
                            max: 60,
                            value: localSettings.duration / 1000,
                            onChange: (e) => handleChange('duration', Math.min(60, Math.max(1, parseInt(e.target.value))) * 1000),
                            className: 'pingNotification-duration-input'
                        }),
                        React.createElement('span', { className: 'pingNotification-duration-label' }, "seconds")
                    )
                ),
                React.createElement('div', { className: 'pingNotification-separator' }),

                React.createElement('div', { className: 'pingNotification-setting' },
                    React.createElement('label', { className: 'pingNotification-label' }, "Popup Location"),
                    React.createElement('select', {
                        value: localSettings.popupLocation,
                        onChange: (e) => handleChange('popupLocation', e.target.value),
                        className: 'pingNotification-select'
                    },
                        React.createElement('option', { value: "topLeft" }, "Top Left"),
                        React.createElement('option', { value: "topRight" }, "Top Right"),
                        React.createElement('option', { value: "bottomLeft" }, "Bottom Left"),
                        React.createElement('option', { value: "bottomRight" }, "Bottom Right")
                    )
                ),
                React.createElement('div', { className: 'pingNotification-separator' }),

                React.createElement('div', { className: 'pingNotification-buttons' },
                    localSettings.mode === "manual" && React.createElement(React.Fragment, null,
                        React.createElement('button', { 
                            className: 'pingNotification-button', 
                            onClick: () => openModal('guild')
                        }, `Allowed Guilds`),
                        React.createElement('button', { 
                            className: 'pingNotification-button', 
                            onClick: () => openModal('channel')
                        }, `Ignored Channels`),
                        React.createElement('button', { 
                            className: 'pingNotification-button', 
                            onClick: () => openModal('user')
                        }, `Ignored Users`)
                    )
                )
            ),

            React.createElement('div', { className: 'pingNotification-section' },
                React.createElement('h3', { className: 'pingNotification-section-title' }, "Misc Options"),

                
                React.createElement(Switch, {
                    label: "Privacy Mode",
                    checked: localSettings.privacyMode,
                    onChange: (value) => handleChange('privacyMode', value)
                }),

                React.createElement('div', { className: 'pingNotification-separator' }),
                React.createElement(Switch, {
                    label: "Allow notifications in channels you're currently viewing",
                    checked: localSettings.allowNotificationsInCurrentChannel,
                    onChange: (value) => handleChange('allowNotificationsInCurrentChannel', value)
                }),
                React.createElement('div', { className: 'pingNotification-separator' }),

                React.createElement(Switch, {
                    label: "Color senders username based on their role color",
                    checked: localSettings.coloredUsernames,
                    onChange: (value) => handleChange('coloredUsernames', value)
                }),
                React.createElement('div', { className: 'pingNotification-separator' }),

                React.createElement(Switch, {
                    label: "Color user mentions based on their role color",
                    checked: localSettings.colorMentions,
                    onChange: (value) => handleChange('colorMentions', value)
                }),
                React.createElement('div', { className: 'pingNotification-separator' }),

                React.createElement(Switch, {
                    label: "Show nicknames instead of usernames",
                    checked: localSettings.showNicknames,
                    onChange: (value) => handleChange('showNicknames', value)
                }),
                React.createElement('div', { className: 'pingNotification-separator' }),
                React.createElement(Switch, {
                    label: "Blur all content from NSFW (age restricted) channels",
                    checked: localSettings.applyNSFWBlur,
                    onChange: (value) => handleChange('applyNSFWBlur', value)
                })
            )
        );
    }

    function UserSelectionModal({ current, onSave }) {
        const [selectedUsers, setSelectedUsers] = React.useState(new Set(current || []));
        const [searchTerm, setSearchTerm] = React.useState("");

        const friends = React.useMemo(() => {
            return RelationshipStore.getFriendIDs()
                .map(id => UserStore.getUser(id))
                .filter(user => user != null);
        }, []);

        const toggleUser = (userId) => {
            setSelectedUsers(prev => {
                const newSet = new Set(prev);
                if (newSet.has(userId)) {
                    newSet.delete(userId);
                } else {
                    newSet.add(userId);
                }
                onSave(Array.from(newSet));
                return newSet;
            });
        };

        const filteredAndSortedUsers = React.useMemo(() => {
            return friends
                .filter(user => user.username.toLowerCase().includes(searchTerm.toLowerCase()))
                .sort((a, b) => {
                    const aSelected = selectedUsers.has(a.id);
                    const bSelected = selectedUsers.has(b.id);
                    if (aSelected === bSelected) {
                        return a.username.localeCompare(b.username);
                    }
                    return aSelected ? -1 : 1;
                });
        }, [friends, searchTerm, selectedUsers]);

        const renderUser = (user, index, array) => {
            const isSelected = selectedUsers.has(user.id);
            const avatarURL = user.getAvatarURL?.() || `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=32`;

            return React.createElement(React.Fragment, { key: user.id },
                React.createElement('div', {
                    style: {
                        display: 'flex',
                        alignItems: 'center',
                        padding: '8px',
                        cursor: 'pointer',
                        backgroundColor: isSelected ? 'var(--background-modifier-selected)' : 'transparent',
                        borderRadius: '4px',
                        color: 'var(--text-normal)'
                    },
                    onClick: () => toggleUser(user.id)
                },
                    React.createElement('img', {
                        src: avatarURL,
                        alt: user.username,
                        style: { width: '24px', height: '24px', marginRight: '8px', borderRadius: '50%' }
                    }),
                    React.createElement('span', {}, user.username),
                    React.createElement('input', {
                        type: 'checkbox',
                        checked: isSelected,
                        onChange: () => {},
                        style: { marginLeft: 'auto' }
                    })
                ),
                index < array.length - 1 && React.createElement('div', { className: 'pingNotification-separator' })
            );
        };

        return React.createElement('div', { style: { maxHeight: '400px', overflowY: 'auto', padding: '16px' } },
            React.createElement('h3', { 
                style: { 
                    marginBottom: '16px', 
                    color: 'var(--header-primary)',
                    textAlign: 'center',
                    fontSize: '13px'
                } 
            }, `This will ignore selected users, including mentions.`),
            React.createElement('input', {
                type: 'text',
                placeholder: 'Search users...',
                value: searchTerm,
                onChange: (e) => setSearchTerm(e.target.value),
                style: {
                    width: '100%',
                    padding: '8px',
                    marginBottom: '16px',
                    backgroundColor: 'var(--background-tertiary)',
                    color: 'var(--text-normal)',
                    border: 'none',
                    borderRadius: '4px'
                }
            }),
            filteredAndSortedUsers.map(renderUser)
        );
    }


    function ChannelSelectionModal({ current, onSave }) {
        const [selectedChannels, setSelectedChannels] = React.useState(new Set(current || []));
        const [selectedGuild, setSelectedGuild] = React.useState(null);
        const [searchTerm, setSearchTerm] = React.useState("");
        const [expandedCategories, setExpandedCategories] = React.useState(new Set());

        const sortedGuilds = React.useMemo(() => {
            return SortedGuildStore.getGuildFolders().flatMap(folder => folder.guildIds)
                .map(id => GuildStore.getGuild(id))
                .filter(Boolean);
        }, []);

        const toggleChannel = (channelId) => {
            setSelectedChannels(prev => {
                const newSet = new Set(prev);
                if (newSet.has(channelId)) {
                    newSet.delete(channelId);
                } else {
                    newSet.add(channelId);
                }
                onSave(Array.from(newSet));
                return newSet;
            });
        };

        const toggleCategory = (categoryId) => {
            setExpandedCategories(prev => {
                const newSet = new Set(prev);
                if (newSet.has(categoryId)) {
                    newSet.delete(categoryId);
                } else {
                    newSet.add(categoryId);
                }
                return newSet;
            });
        };

        const countSelectedChannelsForGuild = React.useCallback((guildId) => {
            const channelIds = ChannelStore.getChannelIds(guildId);
            const channels = channelIds.map(id => ChannelStore.getChannel(id)).filter(Boolean);
            const textChannels = channels.filter(channel => channel.type === 0);
            return textChannels.filter(channel => selectedChannels.has(channel.id)).length;
        }, [selectedChannels]);

        const renderGuild = (guild) => {
            const selectedCount = countSelectedChannelsForGuild(guild.id);
            const iconURL = getGuildIconURL ? getGuildIconURL(guild) : null;

            return React.createElement('div', {
                key: guild.id,
                onClick: () => setSelectedGuild(guild),
                style: {
                    display: 'flex',
                    alignItems: 'center',
                    padding: '8px',
                    cursor: 'pointer',
                    backgroundColor: 'var(--background-secondary)',
                    borderRadius: '4px',
                    marginBottom: '8px',
                    color: 'var(--text-normal)',
                    transition: 'background-color 0.2s',
                    position: 'relative'
                }
            },
                iconURL ? React.createElement('img', {
                    src: iconURL,
                    alt: guild.name,
                    style: { width: '24px', height: '24px', marginRight: '8px', borderRadius: '50%' }
                }) : React.createElement('div', {
                    style: {
                        width: '24px',
                        height: '24px',
                        marginRight: '8px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--background-tertiary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        fontWeight: 'bold'
                    }
                }, guild.acronym || guild.name.charAt(0)),
                React.createElement('span', {}, guild.name),
                selectedCount > 0 && React.createElement('span', {
                    style: {
                        marginLeft: 'auto',
                        backgroundColor: 'var(--brand-experiment)',
                        color: 'white',
                        borderRadius: '12px',
                        padding: '2px 6px',
                        fontSize: '12px',
                        fontWeight: 'bold'
                    }
                }, selectedCount)
            );
        };

        const renderChannel = (channel) => {
            const isSelected = selectedChannels.has(channel.id);
            const isForum = channel.type === 15;

            const forumIcon = React.createElement('svg', {
                className: "icon_d8bfb3",
                'aria-hidden': "true",
                role: "img",
                xmlns: "http://www.w3.org/2000/svg",
                width: "16",
                height: "16",
                fill: "none",
                viewBox: "0 0 24 24",
                style: { marginRight: '8px' }
            },
                React.createElement('path', {
                    fill: "currentColor",
                    d: "M18.91 12.98a5.45 5.45 0 0 1 2.18 6.2c-.1.33-.09.68.1.96l.83 1.32a1 1 0 0 1-.84 1.54h-5.5A5.6 5.6 0 0 1 10 17.5a5.6 5.6 0 0 1 5.68-5.5c1.2 0 2.32.36 3.23.98Z"
                }),
                React.createElement('path', {
                    fill: "currentColor",
                    d: "M19.24 10.86c.32.16.72-.02.74-.38L20 10c0-4.42-4.03-8-9-8s-9 3.58-9 8c0 1.5.47 2.91 1.28 4.11.14.21.12.49-.06.67l-1.51 1.51A1 1 0 0 0 2.4 18h5.1a.5.5 0 0 0 .49-.5c0-4.2 3.5-7.5 7.68-7.5 1.28 0 2.5.3 3.56.86Z"
                })
            );

            return React.createElement('div', {
                key: channel.id,
                onClick: () => toggleChannel(channel.id),
                style: {
                    display: 'flex',
                    alignItems: 'center',
                    padding: '8px',
                    paddingLeft: '28px',
                    cursor: 'pointer',
                    backgroundColor: isSelected ? 'var(--background-modifier-selected)' : 'transparent',
                    borderRadius: '4px',
                    color: 'var(--text-normal)',
                    transition: 'background-color 0.2s'
                }
            },
                isForum ? forumIcon : React.createElement('span', {
                    style: { marginRight: '8px' }
                }, '#'),
                React.createElement('span', {}, channel.name),
                React.createElement('input', {
                    type: 'checkbox',
                    checked: isSelected,
                    onChange: () => {},
                    style: { marginLeft: 'auto' }
                })
            );
        };

        const renderCategory = (category, channels) => {
            const isExpanded = expandedCategories.has(category.id);
            const selectedCount = channels.filter(channel => selectedChannels.has(channel.id)).length;

            return React.createElement('div', { key: category.id },
                React.createElement('div', {
                    onClick: () => toggleCategory(category.id),
                    style: {
                        display: 'flex',
                        alignItems: 'center',
                        padding: '8px',
                        cursor: 'pointer',
                        backgroundColor: 'var(--background-secondary)',
                        borderRadius: '4px',
                        marginBottom: '4px',
                        color: 'var(--text-normal)',
                        fontWeight: 'bold'
                    }
                },
                    React.createElement('span', { style: { marginRight: '8px' } }, isExpanded ? '▼' : '►'),
                    React.createElement('span', {}, category.name.toUpperCase()),
                    selectedCount > 0 && React.createElement('span', {
                        style: {
                            marginLeft: 'auto',
                            backgroundColor: 'var(--brand-experiment)',
                            color: 'white',
                            borderRadius: '12px',
                            padding: '2px 6px',
                            fontSize: '12px',
                            fontWeight: 'bold'
                        }
                    }, selectedCount)
                ),
                isExpanded && channels.map(renderChannel)
            );
        };

        const renderGuildChannels = () => {
            const channelIds = ChannelStore.getChannelIds(selectedGuild.id);
            const channels = channelIds
                .map(id => ChannelStore.getChannel(id))
                .filter(channel => 
                    channel && 
                    (channel.type === 0 || channel.type === 4 || channel.type === 15) && 
                    PermissionStore.can(BigInt(1024n), channel, UserStore.getCurrentUser())
                );
            
            const sortByPosition = (a, b) => a.position - b.position;

            const categories = channels
                .filter(channel => channel.type === 4)
                .filter(category => 
                    channels.some(ch => (ch.type === 0 || ch.type === 15) && ch.parent_id === category.id)
                )
                .sort(sortByPosition);

            const uncategorizedChannels = channels
                .filter(channel => (channel.type === 0 || channel.type === 15) && !channel.parent_id)
                .sort(sortByPosition);

            return React.createElement(React.Fragment, null,
                React.createElement('button', {
                    onClick: () => setSelectedGuild(null),
                    style: {
                        marginBottom: '16px',
                        padding: '8px',
                        backgroundColor: 'var(--background-modifier-accent)',
                        color: 'var(--text-normal)',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }
                }, "Back to Guilds"),
                categories.map(category => {
                    const categoryChannels = channels
                        .filter(channel => (channel.type === 0 || channel.type === 15) && channel.parent_id === category.id)
                        .sort(sortByPosition);
                    return renderCategory(category, categoryChannels);
                }),
                uncategorizedChannels.length > 0 && renderCategory({ id: 'uncategorized', name: 'Uncategorized' }, uncategorizedChannels)
            );
        };

        return React.createElement('div', { style: { maxHeight: '400px', overflowY: 'auto', padding: '16px' } },
            React.createElement('h3', {
                style: {
                    marginBottom: '16px',
                    color: 'var(--header-primary)',
                    textAlign: 'center',
                    fontSize: '13px'
                }
            }, `This will ignore specific channels, including mentions.`),
            React.createElement('input', {
                type: 'text',
                placeholder: selectedGuild ? 'Search channels...' : 'Search guilds...',
                value: searchTerm,
                onChange: (e) => setSearchTerm(e.target.value),
                style: {
                    width: '100%',
                    padding: '8px',
                    marginBottom: '16px',
                    backgroundColor: 'var(--background-tertiary)',
                    color: 'var(--text-normal)',
                    border: 'none',
                    borderRadius: '4px'
                }
            }),
            selectedGuild
                ? renderGuildChannels()
                : sortedGuilds
                    .filter(guild => guild.name.toLowerCase().includes(searchTerm.toLowerCase()))
                    .map(renderGuild)
        );
    }

    function GuildSelectionModal({ current, onSave }) {
        const [selectedGuilds, setSelectedGuilds] = React.useState(new Set(Object.keys(current || {}).filter(id => current[id])));
        const [searchTerm, setSearchTerm] = React.useState("");
        const [expandedFolders, setExpandedFolders] = React.useState(new Set());

        const guildFolders = React.useMemo(() => {
            return SortedGuildStore.getGuildFolders().map(folder => ({
                ...folder,
                guilds: folder.guildIds.map(id => GuildStore.getGuild(id)).filter(Boolean)
            }));
        }, []);

        const toggleGuild = (guildId) => {
            setSelectedGuilds(prev => {
                const newSet = new Set(prev);
                if (newSet.has(guildId)) {
                    newSet.delete(guildId);
                } else {
                    newSet.add(guildId);
                }
                onSave(Object.fromEntries([...newSet].map(id => [id, true])));
                return newSet;
            });
        };

        const toggleFolder = (folderId) => {
            setExpandedFolders(prev => {
                const newSet = new Set(prev);
                if (newSet.has(folderId)) {
                    newSet.delete(folderId);
                } else {
                    newSet.add(folderId);
                }
                return newSet;
            });
        };

        const renderGuild = (guild) => {
            const isSelected = selectedGuilds.has(guild.id);
            const iconURL = getGuildIconURL ? getGuildIconURL(guild) : null;

            return React.createElement('div', {
                key: guild.id,
                style: {
                    display: 'flex',
                    alignItems: 'center',
                    padding: '8px',
                    cursor: 'pointer',
                    backgroundColor: isSelected ? 'var(--background-modifier-selected)' : 'transparent',
                    borderRadius: '4px',
                    marginBottom: '4px',
                    color: 'var(--text-normal)'
                },
                onClick: () => toggleGuild(guild.id)
            },
                iconURL ? React.createElement('img', {
                    src: iconURL,
                    alt: guild.name,
                    style: { width: '24px', height: '24px', marginRight: '8px', borderRadius: '50%' }
                }) : React.createElement('div', {
                    style: { 
                        width: '24px', 
                        height: '24px', 
                        marginRight: '8px', 
                        borderRadius: '50%', 
                        backgroundColor: 'var(--background-tertiary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        fontWeight: 'bold'
                    }
                }, guild.acronym || guild.name.charAt(0)),
                React.createElement('span', {}, guild.name),
                React.createElement('input', {
                    type: 'checkbox',
                    checked: isSelected,
                    onChange: () => {},
                    style: { marginLeft: 'auto' }
                })
            );
        };

        const renderFolder = (folder) => {
            const isExpanded = expandedFolders.has(folder.id);
            const filteredGuilds = folder.guilds.filter(guild => guild.name.toLowerCase().includes(searchTerm.toLowerCase()));

            if (filteredGuilds.length === 0) return null;

            const folderColor = folder.folderColor ? `#${folder.folderColor.toString(16).padStart(6, '0')}` : 'var(--background-tertiary)';

            return React.createElement('div', { 
                key: folder.id, 
                style: { 
                    marginBottom: '8px',
                    border: `2px solid ${folderColor}`,
                    borderRadius: '6px',
                    overflow: 'hidden'
                } 
            },
                React.createElement('div', {
                    onClick: () => toggleFolder(folder.id),
                    style: {
                        cursor: 'pointer',
                        padding: '8px',
                        backgroundColor: 'var(--background-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        color: 'var(--text-normal)',
                        borderBottom: isExpanded ? `2px solid ${folderColor}` : 'none'
                    }
                },
                    React.createElement('span', { style: { marginRight: '8px' } }, isExpanded ? '▼' : '►'),
                    React.createElement('span', {}, folder.folderName || 'Unnamed Folder')
                ),
                isExpanded && React.createElement('div', { 
                    style: { 
                        marginLeft: '20px',
                        padding: '8px'
                    } 
                },
                    filteredGuilds.map(renderGuild)
                )
            );
        };

        return React.createElement('div', { style: { maxHeight: '400px', overflowY: 'auto', padding: '16px' } },
            React.createElement('h3', { 
                style: { 
                    marginBottom: '16px', 
                    color: 'var(--header-primary)',
                    textAlign: 'center',
                    fontSize: '13px'
                } 
            }, `Here you can select the guilds that you want to receive ALL notifications from.`),
            React.createElement('input', {
                type: 'text',
                placeholder: 'Search guilds...',
                value: searchTerm,
                onChange: (e) => setSearchTerm(e.target.value),
                style: {
                    width: '100%',
                    padding: '8px',
                    marginBottom: '16px',
                    backgroundColor: 'var(--background-tertiary)',
                    color: 'var(--text-normal)',
                    border: 'none',
                    borderRadius: '4px'
                }
            }),
            guildFolders.map(folder => {
                if (folder.guildIds.length === 1) {
                    const guild = folder.guilds[0];
                    return guild && guild.name.toLowerCase().includes(searchTerm.toLowerCase()) ? renderGuild(guild) : null;
                }
                return renderFolder(folder);
            })
        );
    }
