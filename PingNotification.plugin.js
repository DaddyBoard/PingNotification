/**
 * @name PingNotification
 * @author DaddyBoard
 * @version 4.2
 * @description A BetterDiscord plugin to show in-app notifications for direct mentions, direct messages, and messages in specific guilds with a customizable GUI.
 * @website https://github.com/DaddyBoard/PingNotification
 * @source https://raw.githubusercontent.com/DaddyBoard/PingNotification/main/PingNotification.plugin.js
 */


function lerp(a, b, t) {
    return a + (b - a) * t;
}


function getHighestRole(guildId, userId) {
    const guild = GuildStore.getGuild(guildId);
    if (!guild || !guild.members) return null;

    const member = guild.members[userId];
    if (!member || !member.roles) return null;

    const guildRoles = GuildStore.getRoles(guildId);
    return member.roles
        .map(roleId => guildRoles[roleId])
        .filter(role => role && role.color !== 0)
        .sort((a, b) => b.position - a.position)[0];
}

function getRoleColor(role) {
    if (!role || !role.color) return '#7289da';
    try {
        return ColorConverter.int2hex(role.color);
    } catch (error) {
        console.warn('ColorConverter not available, using fallback:', error);
        return int2hex(role.color);
    }
}

function int2hex(int) {
    return '#' + int.toString(16).padStart(6, '0');
}

function getColorForPercentage(pct) {
    const r = lerp(0, 255, 1 - pct);
    const g = lerp(255, 0, 1 - pct);
    return `rgb(${Math.round(r)}, ${Math.round(g)}, 0)`;
}

module.exports = (() => {
    const config = {
        info: {
            name: "PingNotification",
            authors: [
                {
                    name: "DaddyBoard",
                    discord_id: "241334335884492810",
                    github_username: "DaddyBoard",
                }
            ],
            version: "4.2",
            description: "Shows in-app notifications for mentions, DMs, and messages in specific guilds with customizable settings.",
            github: "https://github.com/YourGitHubUsername/PingNotification",
            github_raw: "https://raw.githubusercontent.com/YourGitHubUsername/PingNotification/main/PingNotification.plugin.js"
        },
        changelog: [
            {
                title: "Big Update",
                items: [
                    "Now properly shows colors of @mentions, @role mentions, etc"
                ]
            }
        ],
        main: "index.js"
    };

    // Global instance tracker
    if (!global.PingNotificationInstances) {
        global.PingNotificationInstances = new Set();
    }

    return !global.ZeresPluginLibrary ? class {
        constructor() { this._config = config; }
        getName() { return config.info.name; }
        getAuthor() { return config.info.authors.map(a => a.name).join(", "); }
        getDescription() { return config.info.description; }
        getVersion() { return config.info.version; }
        load() {
            BdApi.showConfirmationModal("Library Missing", `The library plugin needed for ${config.info.name} is missing. Please click Download Now to install it.`, {
                confirmText: "Download Now",
                cancelText: "Cancel",
                onConfirm: () => {
                    require("request").get("https://rauenzi.github.io/BDPluginLibrary/release/0PluginLibrary.plugin.js", async (error, response, body) => {
                        if (error) return require("electron").shell.openExternal("https://betterdiscord.net/ghdl?url=https://raw.githubusercontent.com/rauenzi/BDPluginLibrary/master/release/0PluginLibrary.plugin.js");
                        await new Promise(r => require("fs").writeFile(require("path").join(BdApi.Plugins.folder, "0PluginLibrary.plugin.js"), body, r));
                    });
                }
            });
        }
        start() { }
        stop() { }
    } : (([Plugin, Api]) => {
    const plugin = (Plugin, Library) => {
        const { DiscordModules, WebpackModules, PluginUtilities, Settings, Patcher } = Library;
        const { React, ReactDOM, Dispatcher, UserStore, ChannelStore, NavigationUtils, UserStatusStore, SelectedChannelStore, GuildMemberStore } = DiscordModules;
        const { Webpack } = BdApi;
        const GuildStore = Webpack.getStore("GuildStore");
        const ColorConverter = WebpackModules.getByProps('int2hex');

        
        return class PingNotification extends Plugin {
            constructor() {
                super();
                this.defaultSettings = {
                    duration: 15000,
                    ignoredUsers: "",
                    allowedGuilds: {},
                    blockedChannels: [],
                    popupLocation: "bottomRight"
                    };
                this.activeNotifications = [];
                this._boundListener = this.onMessageReceived.bind(this);
            }

            async onStart() {
                PluginUtilities.addStyle(this.getName(), this.css);
                this.subscribeToMessages();
                this.initializeSettings();
                BdApi.showToast("PingNotification started successfully!", {type: "success"});
            }

            onStop() {
                this.unsubscribeFromMessages();
                this.removeAllNotifications();
                PluginUtilities.removeStyle(this.getName());
                BdApi.showToast("PingNotification stopped successfully!", {type: "success"});
            }

            getSettingsPanel() {
                const panel = document.createElement("div");
                panel.className = "pingNotification-settings";

                
                const style = document.createElement('style');
                style.textContent = `
                    .pingNotification-settings {
                        color: var(--header-primary);
                        background-color: var(--background-primary);
                        padding: 16px;
                        font-size: 16px;
                    }
                    .pingNotification-settings h2 {
                        margin-top: 20px;
                        margin-bottom: 10px;
                        font-weight: 600;
                    }
                    .pingNotification-settings .slider-container {
                        display: flex;
                        align-items: center;
                        margin-bottom: 15px;
                    }
                    .pingNotification-settings .slider {
                        flex-grow: 1;
                        margin-right: 10px;
                    }
                    .pingNotification-settings .slider-value {
                        width: 50px;
                        text-align: right;
                    }
                    .pingNotification-settings .guild-list,
                    .pingNotification-settings .user-list,
                    .pingNotification-settings .channel-list {
                        max-height: 150px;
                        overflow-y: auto;
                        margin-bottom: 15px;
                        padding: 10px;
                        background-color: var(--background-secondary);
                        border-radius: 3px;
                    }
                    .pingNotification-settings .list-item {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 5px;
                    }
                    .pingNotification-settings .remove-btn {
                        background-color: var(--button-danger-background);
                        color: var(--button-danger-text);
                        border: none;
                        padding: 5px 10px;
                        border-radius: 3px;
                        cursor: pointer;
                    }
                    .pingNotification-settings .add-btn {
                        background-color: var(--button-positive-background);
                        color: var(--button-positive-text);
                        border: none;
                        padding: 5px 10px;
                        border-radius: 3px;
                        cursor: pointer;
                        margin-top: 10px;
                    }
                    .pingNotification-modal {
                        position: fixed;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background-color: rgba(0, 0, 0, 0.7);
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        z-index: 9999;
                    }
                    .pingNotification-modal-content {
                        background-color: var(--background-primary);
                        padding: 20px;
                        border-radius: 5px;
                        max-width: 400px;
                        width: 100%;
                    }
                    .pingNotification-modal-header {
                        font-size: 18px;
                        font-weight: bold;
                        margin-bottom: 15px;
                    }
                    .pingNotification-modal-body {
                        margin-bottom: 15px;
                    }
                    .pingNotification-modal-footer {
                        display: flex;
                        justify-content: flex-end;
                    }
                    .pingNotification-modal-btn {
                        margin-left: 10px;
                        padding: 5px 10px;
                        border: none;
                        border-radius: 3px;
                        cursor: pointer;
                    }
                    .pingNotification-modal-btn-primary {
                        background-color: var(--button-positive-background);
                        color: var(--button-positive-text);
                    }
                    .pingNotification-modal-btn-secondary {
                        background-color: var(--button-secondary-background);
                        color: var(--button-secondary-text);
                    }
                `;
                panel.appendChild(style);

                // 1. Notification Settings
                panel.appendChild(this.createHeader("Notification Settings"));
                const sliderContainer = document.createElement("div");
                sliderContainer.className = "slider-container";
                const slider = document.createElement("input");
                slider.type = "range";
                slider.min = "5";
                slider.max = "30";
                slider.value = this.settings.duration / 1000;
                slider.className = "slider";
                const sliderValue = document.createElement("span");
                sliderValue.className = "slider-value";
                sliderValue.textContent = `${slider.value}s`;
                slider.oninput = () => {
                    this.settings.duration = slider.value * 1000;
                    sliderValue.textContent = `${slider.value}s`;
                    this.saveSettings();
                };
                sliderContainer.appendChild(slider);
                sliderContainer.appendChild(sliderValue);
                panel.appendChild(sliderContainer);


                panel.appendChild(this.createDropdown("Popup Location", [
                    { value: "topRight", label: "Top Right" },
                    { value: "bottomRight", label: "Bottom Right" },
                    { value: "bottomLeft", label: "Bottom Left" },
                    { value: "topLeft", label: "Top Left" }
                ], this.settings.popupLocation, (value) => {
                    this.settings.popupLocation = value;
                    this.saveSettings();
                }));

                // 2. Allowed/Disallowed Servers
                panel.appendChild(this.createHeader("Allowed Servers"));
                const guildList = document.createElement("div");
                guildList.className = "guild-list";
                Object.values(GuildStore.getGuilds()).forEach(guild => {
                    const guildItem = document.createElement("div");
                    guildItem.className = "list-item";
                    const guildCheck = document.createElement("input");
                    guildCheck.type = "checkbox";
                    guildCheck.checked = this.settings.allowedGuilds[guild.id] || false;
                    guildCheck.onchange = () => {
                        this.settings.allowedGuilds[guild.id] = guildCheck.checked;
                        this.saveSettings();
                    };
                    const guildLabel = document.createElement("label");
                    guildLabel.textContent = guild.name;
                    guildLabel.prepend(guildCheck);
                    guildItem.appendChild(guildLabel);
                    guildList.appendChild(guildItem);
                });
                panel.appendChild(guildList);

                // 3. Blocked Users
                panel.appendChild(this.createHeader("Blocked Users"));
                const userList = document.createElement("div");
                userList.className = "user-list";

                const updateUserList = () => {
                    userList.innerHTML = '';
                    this.settings.ignoredUsers.split(',').map(id => id.trim()).forEach(userId => {
                        if (userId) {
                            const userItem = document.createElement("div");
                            userItem.className = "list-item";
                            const userName = UserStore.getUser(userId)?.username || userId;
                            userItem.textContent = userName;
                            const removeBtn = document.createElement("button");
                            removeBtn.textContent = "Remove";
                            removeBtn.className = "remove-btn";
                            removeBtn.onclick = () => {
                                this.settings.ignoredUsers = this.settings.ignoredUsers
                                    .split(',')
                                    .filter(id => id.trim() !== userId)
                                    .join(',');
                                this.saveSettings();
                                updateUserList();
                            };
                            userItem.appendChild(removeBtn);
                            userList.appendChild(userItem);
                        }
                    });
                };
                updateUserList();
                panel.appendChild(userList);

                const addUserBtn = document.createElement("button");
                addUserBtn.textContent = "Add User";
                addUserBtn.className = "add-btn";
                addUserBtn.onclick = () => {
                    this.showAddModal('user', (userId) => {
                        if (userId) {
                            this.settings.ignoredUsers += (this.settings.ignoredUsers ? ',' : '') + userId;
                            this.saveSettings();
                            updateUserList();
                        }
                    });
                };
                panel.appendChild(addUserBtn);

                // 4. Blocked Channels
                panel.appendChild(this.createHeader("Blocked Channels"));
                const channelList = document.createElement("div");
                channelList.className = "channel-list";

                const updateChannelList = () => {
                    channelList.innerHTML = '';
                    this.settings.blockedChannels.forEach(channelId => {
                        const channelItem = document.createElement("div");
                        channelItem.className = "list-item";
                        const channel = ChannelStore.getChannel(channelId);
                        channelItem.textContent = channel ? `#${channel.name}` : channelId;
                        const removeBtn = document.createElement("button");
                        removeBtn.textContent = "Remove";
                        removeBtn.className = "remove-btn";
                        removeBtn.onclick = () => {
                            this.settings.blockedChannels = this.settings.blockedChannels.filter(id => id !== channelId);
                            this.saveSettings();
                            updateChannelList();
                        };
                        channelItem.appendChild(removeBtn);
                        channelList.appendChild(channelItem);
                    });
                };
                updateChannelList();
                panel.appendChild(channelList);

                const addChannelBtn = document.createElement("button");
                addChannelBtn.textContent = "Add Channel";
                addChannelBtn.className = "add-btn";
                addChannelBtn.onclick = () => {
                    this.showAddModal('channel', (channelId) => {
                        if (channelId) {
                            this.settings.blockedChannels.push(channelId);
                            this.saveSettings();
                            updateChannelList();
                        }
                    });
                };
                panel.appendChild(addChannelBtn);

                return panel;
            }

            createHeader(text) {
                const header = document.createElement("h2");
                header.textContent = text;
                return header;
            }

            createDropdown(labelText, options, currentValue, onChange) {
                const container = document.createElement("div");
                const label = document.createElement("label");
                label.textContent = labelText;
                const select = document.createElement("select");
                options.forEach(option => {
                    const optionElement = document.createElement("option");
                    optionElement.value = option.value;
                    optionElement.textContent = option.label;
                    optionElement.selected = currentValue === option.value;
                    select.appendChild(optionElement);
                });
                select.onchange = () => {
                    onChange(select.value);
                    this.saveSettings();
                };
                container.appendChild(label);
                container.appendChild(select);
                return container;
            }

            showAddModal(type, callback) {
                const modal = document.createElement('div');
                modal.className = 'pingNotification-modal';

                const content = document.createElement('div');
                content.className = 'pingNotification-modal-content';

                const header = document.createElement('div');
                header.className = 'pingNotification-modal-header';
                header.textContent = `Add ${type === 'user' ? 'User' : 'Channel'}`;

                const body = document.createElement('div');
                body.className = 'pingNotification-modal-body';

                const input = document.createElement('input');
                input.type = 'text';
                input.placeholder = `Enter ${type} ID`;

                const footer = document.createElement('div');
                footer.className = 'pingNotification-modal-footer';

                const cancelBtn = document.createElement('button');
                cancelBtn.className = 'pingNotification-modal-btn pingNotification-modal-btn-secondary';
                cancelBtn.textContent = 'Cancel';
                cancelBtn.onclick = () => document.body.removeChild(modal);

                const addBtn = document.createElement('button');
                addBtn.className = 'pingNotification-modal-btn pingNotification-modal-btn-primary';
                addBtn.textContent = 'Add';
                addBtn.onclick = () => {
                    const value = input.value.trim();
                    if (value) {
                        callback(value);
                        document.body.removeChild(modal);
                    }
                };

                body.appendChild(input);
                footer.appendChild(cancelBtn);
                footer.appendChild(addBtn);

                content.appendChild(header);
                content.appendChild(body);
                content.appendChild(footer);

                modal.appendChild(content);
                document.body.appendChild(modal);
            }

            createInputField(labelText, type, value, onChange, attributes = {}) {
                const container = document.createElement("div");
                const label = document.createElement("label");
                label.textContent = labelText;
                const input = document.createElement("input");
                input.type = type;
                input.value = value;
                for (const [attr, attrValue] of Object.entries(attributes)) {
                    input.setAttribute(attr, attrValue);
                }
                input.onchange = () => {
                    onChange(input.value);
                    this.saveSettings();
                };
                container.appendChild(label);
                container.appendChild(input);
                return container;
            }

            initializeSettings() {
                const guilds = Object.values(GuildStore.getGuilds());
                guilds.forEach(guild => {
                    if (this.settings.allowedGuilds[guild.id] === undefined) {
                        this.settings.allowedGuilds[guild.id] = false;
                    }
                });
                this.saveSettings();
            }

            css = `
                    .ping-notification {
                        position: fixed;
                        right: 20px;
                        padding: 16px;
                        background-color: rgba(54, 57, 63, 0.9);
                        color: #ffffff;
                        border-radius: 8px;
                        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
                        z-index: 9999;
                        width: 320px;
                        cursor: pointer;
                        font-family: 'Whitney', 'Helvetica Neue', Helvetica, Arial, sans-serif;
                        border: 1px solid rgba(255, 255, 255, 0.1);
                        transition: all 0.3s ease-in-out;
                        display: flex;
                        flex-direction: column;
                        backdrop-filter: blur(10px);
                        animation: notificationPop 0.5s ease-out;
                    }
                    .ping-notification:hover {
                        background-color: rgba(54, 57, 63, 1);
                        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
                        transform: translateY(-2px);
                    }
                    .ping-notification-header {
                        display: flex;
                        align-items: center;
                        margin-bottom: 8px;
                    }
                    .ping-notification-avatar {
                        width: 32px;
                        height: 32px;
                        border-radius: 50%;
                        margin-right: 12px;
                        background-color: #5865f2;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-weight: bold;
                        font-size: 16px;
                        color: #ffffff;
                    }
                    .ping-notification-title {
                        font-weight: 600;
                        font-size: 13px;
                        color: #ffffff;
                        flex-grow: 1;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    }
                    .ping-notification-close {
                        cursor: pointer;
                        color: rgba(255, 255, 255, 0.5);
                        font-size: 18px;
                        transition: color 0.2s ease;
                    }
                    .ping-notification-close:hover {
                        color: #ffffff;
                    }
                    .ping-notification-content {
                        font-size: 14px;
                        line-height: 1.4;
                        word-break: break-word;
                        max-height: 120px;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    }
                    .ping-notification-image {
                        max-width: 100%;
                        max-height: 200px;
                        border-radius: 4px;
                        margin-top: 8px;
                    }
                    .ping-notification-progress {
                        position: absolute;
                        bottom: 0;
                        left: 0;
                        height: 3px;
                        background-color: #5865f2;
                        border-radius: 0 0 8px 8px;
                    }
                    .ping-notification {
                        box-sizing: border-box;
                    }
                    .ping-notification-image {
                        max-width: 100%;
                        max-height: 150px;
                        object-fit: cover;
                        border-radius: 4px;
                        margin-top: 8px;
                    }
                    .ping-notification {
                        box-sizing: border-box;
                        max-height: 300px;
                        overflow: hidden;
                    }
                    .ping-notification-body {
                        display: flex;
                        flex-direction: column;
                        max-height: 220px;
                        overflow-y: auto;
                    }
                    .ping-notification-content {
                        font-size: 14px;
                        line-height: 1.4;
                        word-break: break-word;
                        margin-bottom: 8px;
                    }
                    .ping-notification-image {
                        max-width: 100%;
                        max-height: 150px;
                        object-fit: cover;
                        border-radius: 4px;
                    }
                    .ping-notification {
                        box-sizing: border-box;
                        max-height: 300px;
                        overflow: hidden;
                    }
                    .ping-notification-body {
                        display: flex;
                        flex-direction: column;
                        max-height: 220px;
                        overflow-y: auto;
                    }
                    .ping-notification-content {
                        font-size: 14px;
                        line-height: 1.4;
                        word-break: break-word;
                        margin-bottom: 8px;
                    }
                    .ping-notification-image {
                        max-width: 100%;
                        max-height: 150px;
                        object-fit: cover;
                        border-radius: 4px;
                    }
                    .ping-notification-progress {
                        position: absolute;
                        bottom: 0;
                        right: 0;
                        height: 3px;
                        background-color: #5865f2;
                        border-radius: 0 0 8px 0;
                        transition: width 0.1s linear, background-color 0.1s linear;
                    }
                    .ping-notification {
                        left: auto;
                        right: auto;
                    }
                    @keyframes notificationPop {
                        0% {
                            transform: scale(0.5);
                            opacity: 0;
                        }
                        50% {
                            transform: scale(1.1);
                        }
                        75% {
                            transform: scale(0.95);
                        }
                        100% {
                            transform: scale(1);
                            opacity: 1;
                        }
                    }
                    .ping-notification-new {
                        animation: notificationPop 0.5s ease-out, notificationGlow 2s ease-in-out;
                    }
                    @keyframes notificationGlow {
                        0%, 100% {
                            box-shadow: 0 4px 20px rgba(88, 101, 242, 0.3);
                        }
                        50% {
                            box-shadow: 0 4px 20px rgba(88, 101, 242, 0.8);
                        }
                    }
                `;

                subscribeToMessages() {
                    Dispatcher.subscribe("MESSAGE_CREATE", this._boundListener);
                }

                unsubscribeFromMessages() {
                    Dispatcher.unsubscribe("MESSAGE_CREATE", this._boundListener);
                }

                onMessageReceived(event) {
                    const { message } = event;
                    const channel = ChannelStore.getChannel(message.channel_id);
                    const currentUser = UserStore.getCurrentUser();

                    if (!channel || message.author.id === currentUser.id) return;

                    if (this.shouldNotify(message, channel)) {
                        this.showNotification(message, channel);
                    }
                }

                shouldNotify(message, channel) {
                    const currentUser = UserStore.getCurrentUser();
                    const ignoredUsers = this.settings.ignoredUsers.split(',').map(id => id.trim());

                    // Early return conditions
                    if (ignoredUsers.includes(message.author.id)) return false;
                    if (this.settings.blockedChannels.includes(channel.id)) return false;

                    // Check for direct mentions
                    const mentionIds = message.mentions.map(mention => mention.id);
                    if (mentionIds.includes(currentUser.id)) return true;

                    // Check for @everyone mention
                    if (message.mention_everyone) return true;

                    // Check for role mentions
                    if (message.mention_roles.length > 0) {
                        const guildMember = GuildMemberStore.getMember(channel.guild_id, currentUser.id);
                        if (guildMember && guildMember.roles) {
                            const userRoles = guildMember.roles;
                            const isRoleMentioned = message.mention_roles.some(roleId => userRoles.includes(roleId));
                            if (isRoleMentioned) return true;
                        }
                    }

                    // Check for DMs
                    if (!channel.guild_id) return true;

                    // For non-mention messages, only allow from specified guilds
                    return this.settings.allowedGuilds[channel.guild_id] || false;
                }

                
                showNotification(message, channel) {
                    try {
                        const notification = document.createElement("div");
                        notification.className = "ping-notification ping-notification-new";
                        notification.style.visibility = "hidden";

                        const title = this.getNotificationTitle(message, channel);
                        const content = this.truncateContent(this.parseDiscordFormatting(message.content, channel));
                        const avatarUrl = this.getAvatarUrl(message.author);

                        notification.innerHTML = `
                            <div class="ping-notification-header">
                                <div class="ping-notification-avatar">${message.author.username.charAt(0)}</div>
                                <div class="ping-notification-title">${title}</div>
                                <span class="ping-notification-close">×</span>
                            </div>
                            <div class="ping-notification-body">
                                <div class="ping-notification-content">${content}</div>
                            </div>
                            <div class="ping-notification-progress"></div>
                        `;

                        const avatarElement = notification.querySelector(".ping-notification-avatar");
                        if (avatarUrl) {
                            avatarElement.style.backgroundImage = `url(${avatarUrl})`;
                            avatarElement.style.backgroundSize = 'cover';
                            avatarElement.textContent = '';
                        }

                        const notificationBody = notification.querySelector(".ping-notification-body");

                        // Set initial position based on popupLocation setting
                        this.setNotificationPosition(notification);
                        notification.style.visibility = "visible";

                        if (message.attachments && message.attachments.length > 0) {
                            const img = document.createElement("img");
                            img.src = message.attachments[0].url;
                            img.className = "ping-notification-image";
                            notificationBody.appendChild(img);
                        }

                        notification.querySelector(".ping-notification-close").onclick = (e) => {
                            e.stopPropagation();
                            this.removeNotification(notification);
                        };

                        notification.onclick = () => {
                            NavigationUtils.transitionTo(`/channels/${channel.guild_id || "@me"}/${channel.id}/${message.id}`);
                            this.removeNotification(notification);
                        };

                        document.body.appendChild(notification);
                        this.activeNotifications.push(notification);

                        // Set initial position before making visible
                        this.adjustNotificationPositions();
                        notification.style.visibility = "visible";

                        // Remove the 'new' class after the animation completes
                        setTimeout(() => {
                            notification.classList.remove("ping-notification-new");
                        }, 2500);

                        const progress = notification.querySelector(".ping-notification-progress");
                        let startTime = Date.now();
                        let pausedTime = 0;
                        let isPaused = false;

                        const updateProgress = () => {
                            if (!document.body.contains(notification)) return;

                            const currentTime = Date.now();
                            const elapsedTime = isPaused ? pausedTime : (currentTime - startTime);
                            const percentage = Math.min(elapsedTime / this.settings.duration, 1);
                            const width = 100 - (percentage * 100);

                            progress.style.width = `${width}%`;
                            progress.style.backgroundColor = getColorForPercentage(1 - percentage);

                            if (percentage < 1 && document.body.contains(notification)) {
                                requestAnimationFrame(updateProgress);
                            } else if (percentage >= 1) {
                                this.removeNotification(notification);
                            }
                        };

                        notification.addEventListener('mouseenter', () => {
                            isPaused = true;
                            pausedTime = Date.now() - startTime;
                        });

                        notification.addEventListener('mouseleave', () => {
                            isPaused = false;
                            startTime = Date.now() - pausedTime;
                        });

                        requestAnimationFrame(updateProgress);

                    } catch (error) {
                        console.error('Error showing notification:', error);
                        
                        Toasts.error('Error showing notification. Check console for details.');
                    }
                }

                
                setNotificationPosition(notification) {
                    const { popupLocation } = this.settings;
                    notification.style.top = "auto";
                    notification.style.bottom = "auto";
                    notification.style.left = "auto";
                    notification.style.right = "auto";

                    switch (popupLocation) {
                        case "topRight":
                            notification.style.top = "20px";
                            notification.style.right = "20px";
                            break;
                        case "bottomRight":
                            notification.style.bottom = "20px";
                            notification.style.right = "20px";
                            break;
                        case "bottomLeft":
                            notification.style.bottom = "20px";
                            notification.style.left = "20px";
                            break;
                        case "topLeft":
                            notification.style.top = "20px";
                            notification.style.left = "20px";
                            break;
                    }
                }

                
                adjustNotificationPositions() {
                    const { popupLocation } = this.settings;
                    let offset = 20;
                    const isTop = popupLocation.startsWith("top");
                    const isLeft = popupLocation.endsWith("Left");

                    this.activeNotifications.slice().reverse().forEach((notification, index) => {
                        const height = notification.offsetHeight;
                        this.setNotificationPosition(notification);

                        if (isTop) {
                            notification.style.top = `${offset}px`;
                        } else {
                            notification.style.bottom = `${offset}px`;
                        }

                        if (isLeft) {
                            notification.style.left = "20px";
                        } else {
                            notification.style.right = "20px";
                        }

                        offset += height + 10;
                    });
                }


                truncateContent(content) {
                    if (content.length > 150) {
                        return content.substring(0, 150) + '...';
                    }
                    return content;
                }

                getAvatarUrl(user) {
                    if (user.avatar) {
                        return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`;
                    }
                    return null;
                }

                getNotificationTitle(message, channel) {
                    let title = message.author.username;
                    if (channel.guild_id) {
                        const guild = GuildStore.getGuild(channel.guild_id);
                        title += ` • ${guild.name} • #${channel.name}`;
                    }
                    if (!channel.guild_id) {
                        title += ` • DM`;
                    }
                    return title;
                }

                
                parseDiscordFormatting(content, channel) {
                    content = content.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
                    content = content.replace(/\*(.+?)\*/g, '<em>$1</em>');
                    content = content.replace(/`(.+?)`/g, '<code>$1</code>');
                    content = content.replace(/<@!?(\d+)>/g, (match, userId) => {
                        try {
                            const user = UserStore.getUser(userId);
                            if (user && channel.guild_id) {
                                const member = GuildMemberStore.getMember(channel.guild_id, userId);
                                if (member && member.colorString) {
                                    return `<span style="color: ${member.colorString};">@${user.username}</span>`;
                                }
                            }
                            return `<span style="color: #7289da;">@${user ? user.username : 'Unknown User'}</span>`;
                        } catch (error) {
                            console.error('Error parsing user mention:', error);
                            return `<span style="color: #7289da;">@Unknown User</span>`;
                        }
                    });

                    content = content.replace(/<@&(\d+)>/g, (match, roleId) => {
                        try {
                            if (channel && channel.guild_id) {
                                const roles = GuildStore.getRoles(channel.guild_id);
                                if (roles) {
                                    const role = roles[roleId];
                                    if (role) {
                                        let roleColor;
                                        if (role.color) {
                                            try {
                                                roleColor = ColorConverter.int2hex(role.color);
                                            } catch (error) {
                                                console.warn('ColorConverter not available, using fallback:', error);
                                                roleColor = int2hex(role.color);
                                            }
                                        } else {
                                            roleColor = '#7289da';
                                        }
                                        return `<span style="color: ${roleColor};">@${role.name}</span>`;
                                    }
                                }
                            }
                            return `<span style="color: #7289da;">@Role</span>`;
                        } catch (error) {
                            console.error('Error parsing role mention:', error);
                            return `<span style="color: #7289da;">@Role</span>`;
                        }
                    });

                    content = content.replace(/@(everyone|here)/g, (match, mention) => {
                        return `<span style="color: #7289da;">@${mention}</span>`;
                    });

                    return content;
                }

                getNotificationTitle(message, channel) {
                    let title = message.author.username;
                    if (channel.guild_id) {
                        const guild = GuildStore.getGuild(channel.guild_id);
                        title += ` • ${guild.name} • #${channel.name}`;
                    }
                    if (!channel.guild_id) {
                        title += ` • DM`;
                    }
                    return title;
                }


                removeNotification(notification) {
                    if (document.body.contains(notification)) {
                        document.body.removeChild(notification);
                        this.activeNotifications = this.activeNotifications.filter(n => n !== notification);
                        this.adjustNotificationPositions();
                    }
                }

                removeAllNotifications() {
                    this.activeNotifications.forEach(notification => {
                        if (document.body.contains(notification)) {
                            document.body.removeChild(notification);
                        }
                    });
                    this.activeNotifications = [];
                }
            };
        };
        return plugin(Plugin, Api);
    })(global.ZeresPluginLibrary.buildPlugin(config));
})();
