/**
 * @name PingNotification
 * @author DaddyBoard
 * @version 5.0
 * @description A BetterDiscord plugin to show in-app notifications for mentions, DMs, and messages in specific guilds using React.
 * @website https://github.com/DaddyBoard/PingNotification
 * @source https://raw.githubusercontent.com/DaddyBoard/PingNotification/main/PingNotification.plugin.js
 */

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
            version: "5.0",
            description: "Shows in-app notifications for mentions, DMs, and messages in specific guilds with React components.",
            github: "https://github.com/DaddyBoard/PingNotification",
            github_raw: "https://raw.githubusercontent.com/DaddyBoard/PingNotification/main/PingNotification.plugin.js"
        },
        changelog: [
            {
                title: "React Rewrite",
                items: [
                    "Completely rewritten using React for better performance and maintainability",
                    "Fixed issues with custom emoji and bot message rendering"
                ]
            }
        ],
        main: "index.js"
    };

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
            const { Patcher, WebpackModules, ReactTools, DiscordModules, Settings } = Library;
            const { React, ReactDOM } = BdApi;
            const { Dispatcher, UserStore, ChannelStore, GuildStore, NavigationUtils } = DiscordModules;

            const parse = WebpackModules.getByProps("defaultRules", "parse").parse;

            class PingNotification extends Plugin {
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
                }

                onStart() {
                    this.loadSettings();
                    this.patchDispatcher();
                    BdApi.injectCSS("PingNotificationStyles", this.css);
                    console.log("PingNotification started"); // Debug log
                }

                onStop() {
                    Patcher.unpatchAll();
                    this.removeAllNotifications();
                    BdApi.clearCSS("PingNotificationStyles");
                    console.log("PingNotification stopped"); // Debug log
                }

                loadSettings() {
                    this.settings = BdApi.getData("PingNotification", "settings") || {...this.defaultSettings};
                    console.log("Settings loaded:", this.settings); // Debug log
                }

                saveSettings() {
                    BdApi.setData("PingNotification", "settings", this.settings);
                    console.log("Settings saved:", this.settings); // Debug log
                }

                patchDispatcher() {
                    Patcher.after(Dispatcher, "dispatch", (_, [event]) => {
                        if (event.type === "MESSAGE_CREATE") {
                            this.onMessageReceived(event.message);
                        }
                    });
                }

                onMessageReceived(message) {
                    const channel = ChannelStore.getChannel(message.channel_id);
                    const currentUser = UserStore.getCurrentUser();

                    if (!channel || message.author.id === currentUser.id) return;

                    console.log("Processing message:", message); // Debug log

                    if (this.shouldNotify(message, channel)) {
                        console.log("Showing notification for message:", message); // Debug log
                        this.showNotification(message, channel);
                    }
                }

                shouldNotify(message, channel) {
                    const currentUser = UserStore.getCurrentUser();
                    const ignoredUsers = this.settings.ignoredUsers.split(',').map(id => id.trim());

                    if (ignoredUsers.includes(message.author.id)) return false;
                    if (this.settings.blockedChannels.includes(channel.id)) return false;

                    if (message.mentions.some(mention => mention.id === currentUser.id)) return true;
                    if (message.mention_everyone) return true;

                    if (message.mention_roles.length > 0) {
                        const guildMember = WebpackModules.getByProps("getMember").getMember(channel.guild_id, currentUser.id);
                        if (guildMember && guildMember.roles) {
                            const isRoleMentioned = message.mention_roles.some(roleId => guildMember.roles.includes(roleId));
                            if (isRoleMentioned) return true;
                        }
                    }

                    if (!channel.guild_id) return true;

                    return this.settings.allowedGuilds[channel.guild_id] || false;
                }

                showNotification(message, channel) {
                    console.log("Creating notification element");
                    const notificationElement = document.createElement('div');
                    notificationElement.className = 'ping-notification';
                    notificationElement.creationTime = Date.now();
                    document.body.appendChild(notificationElement);

                    ReactDOM.render(React.createElement(NotificationComponent, {
                        message: message,
                        channel: channel,
                        settings: this.settings,
                        onClose: () => this.removeNotification(notificationElement),
                        onClick: () => {
                            this.onNotificationClick(channel, message);
                            this.removeNotification(notificationElement);
                        }
                    }), notificationElement);

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

                    // Sort notifications based on their creation time
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
                    NavigationUtils.transitionTo(`/channels/${channel.guild_id || "@me"}/${channel.id}/${message.id}`);
                }

                getSettingsPanel() {
                    return React.createElement(SettingsPanel, {
                        settings: this.settings,
                        onSettingsChange: (newSettings) => {
                            this.settings = newSettings;
                            this.saveSettings();
                            this.adjustNotificationPositions(); // Add this line to update positions when settings change
                        }
                    });
                }

                css = `
                    .ping-notification {
                        position: fixed;
                        width: 350px;
                        background-color: rgba(41, 43, 47, 0.9);
                        color: var(--text-normal);
                        border-radius: 8px;
                        box-shadow: var(--elevation-high);
                        z-index: 9999;
                        overflow: hidden;
                        backdrop-filter: blur(5px);
                        animation: notificationPop 0.5s ease-out;
                    }
                    .ping-notification.glow {
                        animation: notificationPop 0.5s ease-out, glowPulse 2s ease-out;
                    }
                    .ping-notification-content {
                        padding: 12px;
                        cursor: pointer;
                        position: relative;
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
                    .ping-notification-body {
                        font-size: 16px;
                        margin-bottom: 8px;
                        word-break: break-word;
                    }
                    .ping-notification-attachment {
                        max-width: 100%;
                        max-height: 150px;
                        border-radius: 4px;
                        margin-top: 8px;
                    }
                    @keyframes notificationPop {
                        0% { transform: scale(0.9); opacity: 0; }
                        50% { transform: scale(1.05); }
                        100% { transform: scale(1); opacity: 1; }
                    }
                    @keyframes glowPulse {
                        0% { box-shadow: 0 0 5px rgba(255, 255, 255, 0.5); }
                        50% { box-shadow: 0 0 20px rgba(255, 255, 255, 0.5); }
                        100% { box-shadow: 0 0 5px rgba(255, 255, 255, 0.5); }
                    }
                `;
                }

            function NotificationComponent({ message, channel, settings, onClose, onClick }) {
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

                const progress = (remainingTime / settings.duration) * 100;

                const getNotificationTitle = () => {
                    let title = message.author.username;
                    if (channel.guild_id) {
                        const guild = GuildStore.getGuild(channel.guild_id);
                        title += ` • ${guild ? guild.name : 'Unknown Server'} • #${channel.name}`;
                    } else {
                        title += ` • DM`;
                    }
                    return title;
                };

                const getAvatarUrl = () => {
                    return message.author.avatar
                        ? `https://cdn.discordapp.com/avatars/${message.author.id}/${message.author.avatar}.png?size=128`
                        : `https://cdn.discordapp.com/embed/avatars/${parseInt(message.author.discriminator) % 5}.png`;
                };

                const truncateMessage = (content) => {
                    if (content.length > 380) {
                        return content.substring(0, 380) + "...";
                    }
                    return content;
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

                    return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
                };

                const interpolateColor = (color1, color2, factor) => {
                    return color1.map((channel, index) => 
                        Math.round(channel + (color2[index] - channel) * factor)
                    );
                };

                return React.createElement('div', {
                    className: `ping-notification-content ${isGlowing ? 'glow' : ''}`,
                    onClick: onClick,
                    onMouseEnter: () => setIsPaused(true),
                    onMouseLeave: () => setIsPaused(false),
                    style: { 
                        position: 'relative', 
                        overflow: 'hidden', 
                        padding: '12px', 
                        paddingBottom: '20px',
                        minHeight: '60px',
                        display: 'flex',
                        flexDirection: 'column',
                        backgroundColor: 'rgba(41, 43, 47, 0.9)',
                        backdropFilter: 'blur(5px)',
                        animation: 'notificationPop 0.5s ease-out',
                    }
                },
                    React.createElement('div', { className: "ping-notification-header" },
                        React.createElement('img', { src: getAvatarUrl(), alt: "Avatar", className: "ping-notification-avatar" }),
                        React.createElement('div', { className: "ping-notification-title" }, getNotificationTitle()),
                        React.createElement('div', { className: "ping-notification-close", onClick: (e) => { e.stopPropagation(); onClose(); } }, '×')
                    ),
                    React.createElement('div', { 
                        className: "ping-notification-body",
                        style: { flex: 1, marginBottom: '5px' }
                    },
                        parse(truncateMessage(message.content), true, { channelId: channel.id })
                    ),
                    message.attachments && message.attachments.length > 0 && 
                        React.createElement('img', { 
                            src: message.attachments[0].url, 
                            alt: "Attachment", 
                            className: "ping-notification-attachment" 
                        }),
                    React.createElement('div', { 
                        style: { 
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            height: '5px',
                            width: '100%',
                            backgroundColor: 'rgba(0, 0, 0, 0.3)',
                        }
                    }),
                    React.createElement('div', { 
                        style: { 
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            height: '5px',
                            width: `${progress}%`,
                            backgroundColor: getProgressColor(),
                            transition: 'width 0.1s linear, background-color 0.5s ease',
                            zIndex: 1,
                        }
                    }),
                    React.createElement('div', {
                        style: {
                            position: 'absolute',
                            bottom: '7px',
                            right: '7px',
                            fontSize: '10px',
                            color: 'rgba(255, 255, 255, 0.7)',
                        }
                    }, `${Math.round(remainingTime / 1000)}s`)
                );
            }

            function SettingsPanel({ settings, onSettingsChange }) {
                const [localSettings, setLocalSettings] = React.useState(settings);

                const handleChange = (key, value) => {
                    const newSettings = { ...localSettings, [key]: value };
                    setLocalSettings(newSettings);
                    onSettingsChange(newSettings);
                };

                return React.createElement('div', { style: { color: 'var(--header-primary)', padding: '16px' } },
                    React.createElement('h2', { style: { marginBottom: '16px' } }, "PingNotification Settings"),
                    React.createElement('div', { style: { marginBottom: '16px' } },
                        React.createElement('label', { style: { display: 'block', marginBottom: '8px' } }, `Notification Duration: ${localSettings.duration / 1000} seconds`),
                        React.createElement('input', { 
                            type: "range", 
                            min: "1000", 
                            max: "30000", 
                            step: "1000",
                            value: localSettings.duration, 
                            onChange: (e) => handleChange('duration', parseInt(e.target.value)),
                            style: { width: '100%' }
                        })
                    ),
                    React.createElement('div', { style: { marginBottom: '16px' } },
                        React.createElement('label', { style: { display: 'block', marginBottom: '8px' } }, "Ignored Users (comma-separated IDs):"),
                        React.createElement('input', { 
                            type: "text", 
                            value: localSettings.ignoredUsers, 
                            onChange: (e) => handleChange('ignoredUsers', e.target.value),
                            style: { width: '100%', padding: '8px' }
                        })
                    ),
                    React.createElement('div', { style: { marginBottom: '16px' } },
                        React.createElement('label', { style: { display: 'block', marginBottom: '8px' } }, "Popup Location:"),
                        React.createElement('select', { 
                            value: localSettings.popupLocation, 
                            onChange: (e) => handleChange('popupLocation', e.target.value),
                            style: { width: '100%', padding: '8px' }
                        },
                            React.createElement('option', { value: "topLeft" }, "Top Left"),
                            React.createElement('option', { value: "topRight" }, "Top Right"),
                            React.createElement('option', { value: "bottomLeft" }, "Bottom Left"),
                            React.createElement('option', { value: "bottomRight" }, "Bottom Right")
                        )
                    ),
                    React.createElement('div', null,
                        React.createElement('h3', { style: { marginBottom: '8px' } }, "Allowed Guilds:"),
                        Object.entries(GuildStore.getGuilds()).map(([id, guild]) => 
                            React.createElement('div', { key: id, style: { marginBottom: '8px' } },
                                React.createElement('label', null,
                                    React.createElement('input', { 
                                        type: "checkbox", 
                                        checked: localSettings.allowedGuilds[id] || false, 
                                        onChange: (e) => handleChange('allowedGuilds', { ...localSettings.allowedGuilds, [id]: e.target.checked })
                                    }),
                                    ' ',
                                    guild.name
                                )
                            )
                        )
                    )
                );
            }

            return PingNotification;
        };

        return plugin(Plugin, Api);
    })(global.ZeresPluginLibrary.buildPlugin(config));
})();
