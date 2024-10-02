/**
 * @name PingNotification
 * @author DaddyBoard
 * @version 5.2
 * @description A BetterDiscord plugin to show in-app notifications for mentions, DMs, and messages in specific guilds.
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
            version: "5.2",
            description: "Shows in-app notifications for mentions, DMs, and messages in specific guilds with React components.",
            github: "https://github.com/DaddyBoard/PingNotification",
            github_raw: "https://raw.githubusercontent.com/DaddyBoard/PingNotification/main/PingNotification.plugin.js"
        },
        changelog: [
            {
                title: "Changes",
                items: [
                    "+v5.2 - Fixed 'Unknown Server' appearing on popups; discord broke something there."
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
            const { Patcher, WebpackModules, DiscordModules } = Library;
            const { React, ReactDOM } = BdApi;
            const { Dispatcher, SelectedChannelStore, UserStore, ChannelStore, NavigationUtils } = DiscordModules;
            const { Webpack } = BdApi;
            const GuildStore = Webpack.getStore("GuildStore");
            const parse = WebpackModules.getByProps("defaultRules", "parse").parse;
            const { debounce } = WebpackModules.getByProps('debounce');
            class PingNotification extends Plugin {
                constructor() {
                    super();
                    this.defaultSettings = {
                        duration: 15000,
                        ignoredUsers: [],
                        ignoredChannels: [],
                        allowedGuilds: {},
                        popupLocation: "bottomRight",
                        isBlacklistMode: true,
                        allowNotificationsInCurrentChannel: false
                    };
                    this.activeNotifications = [];
                }

                onStart() {
                    this.loadSettings();
                    this.patchDispatcher();
                    BdApi.injectCSS("PingNotificationStyles", this.css);
                    console.log("PingNotification started");
                }

                onStop() {
                    Patcher.unpatchAll();
                    this.removeAllNotifications();
                    BdApi.clearCSS("PingNotificationStyles");
                    console.log("PingNotification stopped");
                }

                

                loadSettings() {
                    const savedSettings = BdApi.getData("PingNotification", "settings");
                    this.settings = {
                        ...this.defaultSettings,
                        ...savedSettings,
                        ignoredUsers: Array.isArray(savedSettings?.ignoredUsers) ? savedSettings.ignoredUsers : [],
                        ignoredChannels: Array.isArray(savedSettings?.ignoredChannels) ? savedSettings.ignoredChannels : []
                    };
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

                    //console.log("Processing message:", message);

                    if (this.shouldNotify(message, channel)) {
                        console.log("Showing notification for message:", message);
                        this.showNotification(message, channel);
                    }
                }

                shouldNotify(message, channel) {
                    const currentUser = UserStore.getCurrentUser();

                    // Don't notify if the message is in the current channel
                    if (!this.settings.allowNotificationsInCurrentChannel && channel.id === SelectedChannelStore.getChannelId()) {
                        return false;
                    }

                    // Check if the message is ephemeral
                    if (message.flags && (message.flags & 64) === 64) {
                        return false;
                    }

                    // Check if the message is a mention or everyone ping
                    const isMention = message.mentions.some(mention => mention.id === currentUser.id) || message.mention_everyone;

                    // Check if the author is in the ignored/allowed users list
                    const isUserListed = this.settings.ignoredUsers.includes(message.author.id);

                    // Check if the channel is in the ignored/allowed channels list
                    const isChannelListed = this.settings.ignoredChannels.includes(channel.id);

                    // Check if the guild is in the allowed guilds list
                    const isGuildAllowed = this.settings.allowedGuilds[channel.guild_id] || false;

                    if (message.mention_roles.length > 0) {
                        const guildMember = WebpackModules.getByProps("getMember").getMember(channel.guild_id, currentUser.id);
                        if (guildMember && guildMember.roles) {
                            const isRoleMentioned = message.mention_roles.some(roleId => guildMember.roles.includes(roleId));
                            if (isRoleMentioned) return true;
                        }
                    }

                    if (!channel.guild_id) return true; // Always notify for DMs

                    if (this.settings.isBlacklistMode) {
                        // In blacklist mode, notify if not listed and guild is allowed (unless it's a mention)
                        return isMention || (!isUserListed && !isChannelListed && isGuildAllowed);
                    } else {
                        // In whitelist mode, only notify if listed or guild is allowed (or if it's a mention)
                        return isMention || isUserListed || isChannelListed || isGuildAllowed;
                    }
                }

                showNotification(message, channel) {
                    console.log("Creating notification element");
                    const notificationElement = document.createElement('div');
                    notificationElement.className = 'ping-notification';
                    notificationElement.creationTime = Date.now();
                    document.body.appendChild(notificationElement);

                    ReactDOM.render(
                        React.createElement(NotificationComponent, {
                            message: message,
                            channel: channel,
                            settings: this.settings,
                            onClose: () => this.removeNotification(notificationElement),
                            onClick: () => {
                                this.onNotificationClick(channel, message);
                                this.removeNotification(notificationElement);
                            },
                            onImageLoad: () => {
                                this.adjustNotificationPositions(); // Re-adjust positions when image loads
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
                            this.adjustNotificationPositions();
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

            function NotificationComponent({ message, channel, settings, onClose, onClick, onImageLoad }) {
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
                        if (guild && guild.name) {
                            title += ` • ${guild.name} • #${channel.name}`;
                        } else {
                            title += ` • Unknown Server • #${channel.name}`;
                        }
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
                    if (attachment.content_type.startsWith('image/')) {
                        return React.createElement('img', { 
                            src: attachment.url, 
                            alt: "Attachment", 
                            className: "ping-notification-attachment",
                            onLoad: onImageLoad
                        });
                    } else if (attachment.content_type.startsWith('video/')) {
                        const thumbnailUrl = attachment.proxy_url + '?format=jpeg';
                        return React.createElement('div', { 
                            className: "ping-notification-video-attachment",
                            style: { position: 'relative', display: 'inline-block', alignSelf: 'center' }
                        },
                            React.createElement('img', {
                                src: thumbnailUrl,
                                alt: "Video Thumbnail",
                                className: "ping-notification-attachment",
                                onLoad: onImageLoad
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
                                    alignItems: 'center'
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
                            )
                        );
                    }
                    return null;
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
                    let content = message.content;
                    let embedContent = '';

                    if (message.embeds && message.embeds.length > 0) {
                        embedContent = message.embeds.map(embed => getEmbedContent(embed)).join('\n\n');
                        if (embedContent) {
                            embedContent = `\n\n\n${embedContent}`;
                        }
                    }

                    return truncateMessage(content, embedContent) + embedContent;
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
                            parse(getMessageContent(), true, { channelId: channel.id })
                        ),
                        message.attachments && message.attachments.length > 0 && 
                            renderAttachment(message.attachments[0]),
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
                                backgroundColor: progressColorString,
                                transition: 'width 0.1s linear, background-color 0.5s ease',
                                zIndex: 1,
                            }
                        }),
                        React.createElement('div', {
                            style: {
                                position: 'absolute',
                                bottom: '7px',
                                right: '7px',
                                fontSize: '13px',
                                color: progressColorString,
                                transition: 'color 0.5s ease',
                                fontWeight: 'bold',
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

                const openUserModal = () => {
                    BdApi.showConfirmationModal(`Edit ${localSettings.isBlacklistMode ? "Ignored" : "Allowed"} Users`, 
                        React.createElement(UserSelectionModal, {
                            currentUsers: localSettings.ignoredUsers,
                            onSave: (newUsers) => handleChange('ignoredUsers', newUsers),
                            isBlacklistMode: localSettings.isBlacklistMode
                        }),
                        {
                            confirmText: "Save",
                            cancelText: "Cancel",
                            onConfirm: () => {}
                        }
                    );
                };

                const openChannelModal = () => {
                    BdApi.showConfirmationModal(`Edit ${localSettings.isBlacklistMode ? "Ignored" : "Allowed"} Channels`, 
                        React.createElement(ChannelSelectionModal, {
                            currentChannels: localSettings.ignoredChannels,
                            onSave: (newChannels) => handleChange('ignoredChannels', newChannels),
                            isBlacklistMode: localSettings.isBlacklistMode
                        }),
                        {
                            confirmText: "Save",
                            cancelText: "Cancel",
                            onConfirm: () => {}
                        }
                    );
                };

                return React.createElement('div', { style: { color: 'var(--header-primary)', padding: '16px' } },
                    React.createElement('h2', { style: { marginBottom: '16px' } }, "PingNotification Settings"),
                    React.createElement('div', { style: { marginBottom: '16px' } },
                        React.createElement('label', { style: { display: 'flex', alignItems: 'center', marginBottom: '8px' } },
                            React.createElement('input', {
                                type: "checkbox",
                                checked: localSettings.isBlacklistMode,
                                onChange: (e) => handleChange('isBlacklistMode', e.target.checked),
                                style: { marginRight: '8px' }
                            }),
                            localSettings.isBlacklistMode ? "Blacklist Mode" : "Whitelist Mode"
                        )
                    ),
                    React.createElement('div', { style: { marginBottom: '16px' } },
                        React.createElement('label', { style: { display: 'flex', alignItems: 'center', marginBottom: '8px' } },
                            React.createElement('input', {
                                type: "checkbox",
                                checked: localSettings.allowNotificationsInCurrentChannel,
                                onChange: (e) => handleChange('allowNotificationsInCurrentChannel', e.target.checked),
                                style: { marginRight: '8px' }
                            }),
                            "Allow notifications in channels you're currently viewing"
                        )
                    ),
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
                        React.createElement('label', { style: { display: 'block', marginBottom: '8px' } }, 
                            `${localSettings.isBlacklistMode ? "Ignored" : "Allowed"} Users:`
                        ),
                        React.createElement('button', { 
                            onClick: openUserModal,
                            style: { padding: '8px', marginTop: '4px' }
                        }, "Edit")
                    ),
                    React.createElement('div', { style: { marginBottom: '16px' } },
                        React.createElement('label', { style: { display: 'block', marginBottom: '8px' } }, 
                            `${localSettings.isBlacklistMode ? "Ignored" : "Allowed"} Channels:`
                        ),
                        React.createElement('button', { 
                            onClick: openChannelModal,
                            style: { padding: '8px', marginTop: '4px' }
                        }, "Edit")
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
                        React.createElement('h3', { style: { marginBottom: '8px' } }, 
                            `${localSettings.isBlacklistMode ? "Allowed" : "Ignored"} Guilds:`
                        ),
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

            function UserSelectionModal({ currentUsers, onSave, isBlacklistMode }) {
                const [selectedUsers, setSelectedUsers] = React.useState(new Set(currentUsers));
                const [searchTerm, setSearchTerm] = React.useState("");
                const [filteredFriends, setFilteredFriends] = React.useState([]);

                const friends = React.useMemo(() => {
                    return WebpackModules.getByProps("getFriendIDs").getFriendIDs()
                        .map(id => WebpackModules.getByProps("getUser").getUser(id))
                        .filter(user => user != null);
                }, []);

                const debouncedSearch = React.useMemo(
                    () => debounce((term) => {
                        const filtered = friends.filter(friend => 
                            friend.username.toLowerCase().includes(term.toLowerCase())
                        );
                        setFilteredFriends(filtered);
                    }, 300),
                    [friends]
                );

                React.useEffect(() => {
                    debouncedSearch(searchTerm);
                }, [searchTerm, debouncedSearch]);

                const toggleUser = (userId) => {
                    setSelectedUsers(prevSelected => {
                        const newSelected = new Set(prevSelected);
                        if (newSelected.has(userId)) {
                            newSelected.delete(userId);
                        } else {
                            newSelected.add(userId);
                        }
                        onSave(Array.from(newSelected));
                        return newSelected;
                    });
                };

                const VirtualizedUserList = ({ users }) => {
                    const listRef = React.useRef();
                    const rowHeight = 40;
                    const windowHeight = 300;
                    const [scrollTop, setScrollTop] = React.useState(0);

                    const onScroll = React.useCallback(
                        (e) => setScrollTop(e.currentTarget.scrollTop),
                        []
                    );

                    const startIndex = Math.floor(scrollTop / rowHeight);
                    const endIndex = Math.min(users.length - 1, Math.floor((scrollTop + windowHeight) / rowHeight));

                    const items = [];
                    for (let i = startIndex; i <= endIndex; i++) {
                        const user = users[i];
                        items.push(
                            React.createElement('div', {
                                key: user.id,
                                style: {
                                    height: rowHeight,
                                    padding: '8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    color: 'var(--text-normal)'
                                }
                            },
                                React.createElement('input', {
                                    type: "checkbox",
                                    checked: selectedUsers.has(user.id),
                                    onChange: () => toggleUser(user.id),
                                    style: { marginRight: '8px' }
                                }),
                                user.username
                            )
                        );
                    }

                    return React.createElement('div', {
                        ref: listRef,
                        onScroll: onScroll,
                        style: {
                            height: windowHeight,
                            overflowY: 'auto',
                            backgroundColor: 'var(--background-secondary)',
                            borderRadius: '4px'
                        }
                    },
                        React.createElement('div', {
                            style: { height: users.length * rowHeight, position: 'relative' }
                        },
                            React.createElement('div', {
                                style: {
                                    position: 'absolute',
                                    top: startIndex * rowHeight,
                                    width: '100%'
                                }
                            }, items)
                        )
                    );
                };

                return React.createElement(React.Fragment, null,
                    React.createElement('h3', { 
                        style: { 
                            marginBottom: '16px', 
                            color: 'var(--header-primary)',
                            textAlign: 'center'
                        } 
                    }, `${isBlacklistMode ? "Ignored" : "Allowed"} Users`),
                    React.createElement('input', {
                        type: "text",
                        placeholder: "Search users...",
                        value: searchTerm,
                        onChange: (e) => setSearchTerm(e.target.value),
                        style: { 
                            width: '100%', 
                            padding: '8px', 
                            marginBottom: '16px',
                            color: 'var(--text-normal)',
                            backgroundColor: 'var(--background-secondary)',
                            border: 'none',
                            borderRadius: '4px'
                        }
                    }),
                    React.createElement(VirtualizedUserList, { users: filteredFriends })
                );
            }

            function ChannelSelectionModal({ currentChannels, onSave, isBlacklistMode }) {
                const [selectedChannels, setSelectedChannels] = React.useState(new Set(currentChannels));
                const [selectedGuild, setSelectedGuild] = React.useState(null);
                const [searchTerm, setSearchTerm] = React.useState("");

                const guilds = Object.values(GuildStore.getGuilds());
                const GuildChannelsStore = WebpackModules.getByProps("getChannels", "getDefaultChannel");

                const filteredGuilds = guilds.filter(guild => 
                    guild.name.toLowerCase().includes(searchTerm.toLowerCase())
                );

                const toggleChannel = (channelId) => {
                    const newSelectedChannels = new Set(selectedChannels);
                    if (newSelectedChannels.has(channelId)) {
                        newSelectedChannels.delete(channelId);
                    } else {
                        newSelectedChannels.add(channelId);
                    }
                    setSelectedChannels(newSelectedChannels);
                    onSave(Array.from(newSelectedChannels));
                };

                const renderGuildList = () => {
                    return React.createElement(React.Fragment, null,
                        React.createElement('input', {
                            type: "text",
                            placeholder: "Search guilds...",
                            value: searchTerm,
                            onChange: (e) => setSearchTerm(e.target.value),
                            style: { 
                                width: '100%', 
                                padding: '8px', 
                                marginBottom: '16px',
                                color: 'var(--text-normal)',
                                backgroundColor: 'var(--background-secondary)',
                                border: 'none',
                                borderRadius: '4px'
                            }
                        }),
                        React.createElement('div', { style: { maxHeight: '300px', overflowY: 'auto' } },
                            filteredGuilds.map(guild => 
                                React.createElement('div', { 
                                    key: guild.id, 
                                    onClick: () => setSelectedGuild(guild),
                                    style: { 
                                        cursor: 'pointer', 
                                        padding: '8px', 
                                        marginBottom: '8px', 
                                        backgroundColor: 'var(--background-secondary)',
                                        color: 'var(--text-normal)',
                                        borderRadius: '4px'
                                    }
                                },
                                    guild.name
                                )
                            )
                        )
                    );
                };

                const renderChannelList = () => {
                    const guildChannels = GuildChannelsStore.getChannels(selectedGuild.id);
                    const textChannels = guildChannels.SELECTABLE.map(channel => channel.channel).filter(channel => channel.type === 0);

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
                        React.createElement('div', { style: { maxHeight: '300px', overflowY: 'auto' } },
                            textChannels.map(channel => 
                                React.createElement('div', { key: channel.id, style: { marginBottom: '8px', color: 'var(--text-normal)' } },
                                    React.createElement('label', null,
                                        React.createElement('input', {
                                            type: "checkbox",
                                            checked: selectedChannels.has(channel.id),
                                            onChange: () => toggleChannel(channel.id),
                                            style: { marginRight: '8px' }
                                        }),
                                        channel.name
                                    )
                                )
                            )
                        )
                    );
                };

                return React.createElement(React.Fragment, null,
                    React.createElement('h3', { 
                        style: { 
                            marginBottom: '16px', 
                            color: 'var(--header-primary)',
                            textAlign: 'center'
                        } 
                    }, `${isBlacklistMode ? "Ignored" : "Allowed"} Channels`),
                    selectedGuild ? renderChannelList() : renderGuildList()
                );
            }

            return PingNotification;
        };

        return plugin(Plugin, Api);
    })(global.ZeresPluginLibrary.buildPlugin(config));
})();
