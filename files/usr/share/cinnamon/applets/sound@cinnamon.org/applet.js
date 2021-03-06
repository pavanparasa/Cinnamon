const Applet = imports.ui.applet;
const Mainloop = imports.mainloop;
const Gio = imports.gi.Gio;
const DBus = imports.dbus;
const Lang = imports.lang;
const Cinnamon = imports.gi.Cinnamon;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const Main = imports.ui.main;
const Panel = imports.ui.panel;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const GLib = imports.gi.GLib;
const Tweener = imports.ui.tweener;
const Gvc = imports.gi.Gvc;

const Gettext = imports.gettext.domain('cinnamon-extension-mediaplayer');
const _ = Gettext.gettext;

const PropIFace = {
    name: 'org.freedesktop.DBus.Properties',
    signals: [{ name: 'PropertiesChanged',
                inSignature: 'a{sv}'}]
};

const MediaServer2IFace = {
    name: 'org.mpris.MediaPlayer2',
    methods: [{ name: 'Raise',
                inSignature: '',
                outSignature: '' },
              { name: 'Quit',
                inSignature: '',
                outSignature: '' }],
    properties: [{ name: 'CanRaise',
                   signature: 'b',
                   access: 'read'},
                 { name: 'CanQuit',
                   signature: 'b',
                   access: 'read'}],
};

const MediaServer2PlayerIFace = {
    name: 'org.mpris.MediaPlayer2.Player',
    methods: [{ name: 'PlayPause',
                inSignature: '',
                outSignature: '' },
              { name: 'Pause',
                inSignature: '',
                outSignature: '' },
              { name: 'Play',
                inSignature: '',
                outSignature: '' },
              { name: 'Stop',
                inSignature: '',
                outSignature: '' },
              { name: 'Next',
                inSignature: '',
                outSignature: '' },
              { name: 'Previous',
                inSignature: '',
                outSignature: '' },
              { name: 'SetPosition',
                inSignature: 'a{ov}',
                outSignature: '' }],
    properties: [{ name: 'Metadata',
                   signature: 'a{sv}',
                   access: 'read'},
                 { name: 'Shuffle',
                   signature: 'b',
                   access: 'readwrite'},
                 { name: 'Rate',
                   signature: 'd',
                   access: 'readwrite'},
                 { name: 'LoopStatus',
                   signature: 'b',
                   access: 'readwrite'},
                 { name: 'Volume',
                   signature: 'd',
                   access: 'readwrite'},
                 { name: 'PlaybackStatus',
                   signature: 's',
                   access: 'read'},
                 { name: 'Position',
                   signature: 'x',
                   access: 'read'},
                 { name: 'CanGoNext',
                   signature: 'b',
                   access: 'read'},
                 { name: 'CanGoPrevious',
                   signature: 'b',
                   access: 'read'},
                 { name: 'CanPlay',
                   signature: 'b',
                   access: 'read'},
                 { name: 'CanPause',
                   signature: 'b',
                   access: 'read'},
                 { name: 'CanSeek',
                   signature: 'b',
                   access: 'read'}],
    signals: [{ name: 'Seeked',
                inSignature: 'x' }]
};

/* global values */
let icon_path = "/usr/share/cinnamon/theme/";
let compatible_players = [ "clementine", "mpd", "exaile", "banshee", "rhythmbox", "rhythmbox3", "pragha", "quodlibet", "guayadeque", "amarok", "googlemusicframe", "xbmc", "xnoise" ];
let support_seek = [ "clementine", "banshee", "rhythmbox", "rhythmbox3", "quodlibet", "amarok", "xnoise" ];
/* dummy vars for translation */
let x = _("Playing");
x = _("Paused");
x = _("Stopped");

const VOLUME_NOTIFY_ID = 1;
const VOLUME_ADJUSTMENT_STEP = 0.05; /* Volume adjustment step in % */

const ICON_SIZE = 28;


function Prop() {
    this._init.apply(this, arguments);
}

Prop.prototype = {
    _init: function(owner) {
        DBus.session.proxifyObject(this, owner, '/org/mpris/MediaPlayer2', this);
    }
}
DBus.proxifyPrototype(Prop.prototype, PropIFace)

function MediaServer2() {
    this._init.apply(this, arguments);
}

MediaServer2.prototype = {
    _init: function(owner) {
        DBus.session.proxifyObject(this, owner, '/org/mpris/MediaPlayer2', this);
    },
    getRaise: function(callback) {
        this.GetRemote('CanRaise', Lang.bind(this,
            function(raise, ex) {
                if (!ex)
                    callback(this, raise);
            }));
    },
    getQuit: function(callback) {
        this.GetRemote('CanQuit', Lang.bind(this,
            function(quit, ex) {
                if (!ex)
                    callback(this, quit);
            }));
    }
}
DBus.proxifyPrototype(MediaServer2.prototype, MediaServer2IFace)

function MediaServer2Player() {
    this._init.apply(this, arguments);
}

MediaServer2Player.prototype = {
    _init: function(owner) {
        this._owner = owner;
        DBus.session.proxifyObject(this, owner, '/org/mpris/MediaPlayer2', this);
    },
    getMetadata: function(callback) {
        this.GetRemote('Metadata', Lang.bind(this,
            function(metadata, ex) {
                if (!ex)
                    callback(this, metadata);
            }));
    },
    getPlaybackStatus: function(callback) {
        this.GetRemote('PlaybackStatus', Lang.bind(this,
            function(status, ex) {
                if (!ex)
                    callback(this, status);
            }));
    },
    getRate: function(callback) {
        this.GetRemote('Rate', Lang.bind(this,
            function(rate, ex) {
                if (!ex)
                    callback(this, rate);
            }));
    },
    getPosition: function(callback) {
        this.GetRemote('Position', Lang.bind(this,
            function(position, ex) {
                if (!ex)
                    callback(this, position);
            }));
    },
    getShuffle: function(callback) {
        this.GetRemote('Shuffle', Lang.bind(this,
            function(shuffle, ex) {
                if (!ex)
                    callback(this, shuffle);
            }));
    },
    setShuffle: function(value) {
        this.SetRemote('Shuffle', value);
    },
    getVolume: function(callback) {
        this.GetRemote('Volume', Lang.bind(this,
            function(volume, ex) {
                if (!ex)
                    callback(this, volume);
            }));
    },
    setVolume: function(value) {
        this.SetRemote('Volume', parseFloat(value));
    },
    getRepeat: function(callback) {
        this.GetRemote('LoopStatus', Lang.bind(this,
            function(repeat, ex) {
                if (!ex) {
                    if (repeat == "None")
                        repeat = false
                    else
                        repeat = true
                    callback(this, repeat);
                }
            }));
    },
    setRepeat: function(value) {
        if (value)
            value = "Playlist"
        else
            value = "None"
        this.SetRemote('LoopStatus', value);
    }
}
DBus.proxifyPrototype(MediaServer2Player.prototype, MediaServer2PlayerIFace)

function TrackInfo() {
    this._init.apply(this, arguments);
}

TrackInfo.prototype = {
    _init: function(label, icon) {
        this.actor = new St.BoxLayout({style_class: 'sound-track-info'});
        this.label = new St.Label({text: label.toString()});
        this.icon = new St.Icon({icon_name: icon.toString()});
        this.actor.add_actor(this.icon, { span: 0 });
        this.actor.add_actor(this.label, { span: -1 });
    },
    getActor: function() {
        return this.actor;
    },
    setLabel: function(label) {
        this.label.text = label;
    },
    getLabel: function() {
        return this.label.text.toString();
    },
    hide: function() {
        this.actor.hide();
    },
    show: function() {
        this.actor.show();
    },
};

function ControlButton() {
    this._init.apply(this, arguments);
}

ControlButton.prototype = {
    _init: function(icon, callback) {
        this.actor = new St.Bin({style_class: 'sound-button-container'});
        this.button = new St.Button({ style_class: 'sound-button' });
        this.button.connect('clicked', callback);
        this.icon = new St.Icon({
            icon_type: St.IconType.SYMBOLIC,
            icon_name: icon,
            style_class: 'sound-button-icon',
        });
        this.button.set_child(this.icon);
        this.actor.add_actor(this.button);

    },
    getActor: function() {
        return this.actor;
    },
    setIcon: function(icon) {
        this.icon.icon_name = icon;
    },
}

function TextImageMenuItem() {
    this._init.apply(this, arguments);
}

TextImageMenuItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function(text, icon, image, align, style) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this);

        this.actor = new St.BoxLayout({style_class: style});
        this.actor.add_style_pseudo_class('active');
        if (icon) {
            this.icon = new St.Icon({icon_name: icon});
        }
        if (image) {
            this.icon = new St.Bin();
            this.icon.set_child(this._getIconImage(image));
        }
        this.text = new St.Label({text: text});
        if (align === "left") {
            this.actor.add_actor(this.icon, { span: 0 });
            this.actor.add_actor(this.text, { span: -1 });
        }
        else {
            this.actor.add_actor(this.text, { span: 0 });
            this.actor.add_actor(this.icon, { span: -1 });
        }
    },

    setText: function(text) {
        this.text.text = text;
    },

    setIcon: function(icon) {
        this.icon.icon_name = icon;
    },

    setImage: function(image) {
        this.icon.set_child(this._getIconImage(image));
    },

    // retrieve an icon image
    _getIconImage: function(icon_name) {
         let icon_file = icon_path + icon_name + ".svg";
         let file = Gio.file_new_for_path(icon_file);
         let icon_uri = file.get_uri();
 
         return St.TextureCache.get_default().load_uri_sync(1, icon_uri, 16, 16);
    },
}

function Player() {
    this._init.apply(this, arguments);
}

Player.prototype = {
    __proto__: PopupMenu.PopupMenuSection.prototype,
    
    _init: function(system_status_button, owner) {
        PopupMenu.PopupMenuSection.prototype._init.call(this);

        this._owner = owner;
        this._system_status_button = system_status_button;
        this._name = this._owner.split('.')[3];
        this._mediaServerPlayer = new MediaServer2Player(owner);
        this._mediaServer = new MediaServer2(owner);
        this._prop = new Prop(owner);

        this._playerInfo = new TextImageMenuItem(this._getName(), false, "player-stopped", "left", "popup-menu-item");
        this.addMenuItem(this._playerInfo);

        this._trackCover = new St.Bin({style_class: 'sound-track-cover', x_align: St.Align.MIDDLE});
        this._trackCover.set_child(new St.Icon({icon_name: "media-optical-cd-audio", icon_size: 100, icon_type: St.IconType.FULLCOLOR}));
        this._trackInfos = new St.Bin({style_class: 'sound-track-infos', y_align: St.Align.MIDDLE});
        this._trackControls = new St.Bin({style_class: 'sound-playback-control', x_align: St.Align.MIDDLE});

        let mainBox = new St.BoxLayout({style_class: 'sound-track-box'});
        mainBox.add_actor(this._trackCover);
        mainBox.add_actor(this._trackInfos);

        this.addActor(mainBox);

        this.infos = new St.BoxLayout({vertical: true});
        this._artist = new TrackInfo(_('Unknown Artist'), "system-users");
        this._album = new TrackInfo(_('Unknown Album'), "media-optical");
        this._title = new TrackInfo(_('Unknown Title'), "audio-x-generic");
        this._time = new TrackInfo("0:00 / 0:00", "document-open-recent");
        this.infos.add_actor(this._artist.getActor());
        this.infos.add_actor(this._album.getActor());
        this.infos.add_actor(this._title.getActor());
        this.infos.add_actor(this._time.getActor());
        this._trackInfos.set_child(this.infos);

        this._prevButton = new ControlButton('media-skip-backward',
            Lang.bind(this, function () { this._mediaServerPlayer.PreviousRemote(); }));
        this._playButton = new ControlButton('media-playback-start',
            Lang.bind(this, function () { this._mediaServerPlayer.PlayPauseRemote(); }));
        this._stopButton = new ControlButton('media-playback-stop',
            Lang.bind(this, function () { this._mediaServerPlayer.StopRemote(); }));
        this._nextButton = new ControlButton('media-skip-forward',
            Lang.bind(this, function () { this._mediaServerPlayer.NextRemote(); }));
        
        this.controls = new St.BoxLayout();
        this.controls.add_actor(this._prevButton.getActor());
        this.controls.add_actor(this._playButton.getActor());
        this.controls.add_actor(this._stopButton.getActor());
        this.controls.add_actor(this._nextButton.getActor());
        this._trackControls.set_child(this.controls);
        this.addActor(this._trackControls);
        
        this._mediaServer.getRaise(Lang.bind(this, function(sender, raise) {
            if (raise) {
                this._raiseButton = new ControlButton('go-up',
                    Lang.bind(this, function () { this._mediaServer.RaiseRemote(); this._system_status_button.menu.actor.hide(); }));
                this.controls.add_actor(this._raiseButton.getActor());
            }
        }));
        
        this._mediaServer.getQuit(Lang.bind(this, function(sender, quit) {
            if (quit) {
                this._quitButton = new ControlButton('window-close',
                    Lang.bind(this, function () { this._mediaServer.QuitRemote(); }));
                this.controls.add_actor(this._quitButton.getActor());
            }
        }));      
       
        /* this players don't support seek */
        if (support_seek.indexOf(this._name) == -1)
            this._time.hide();
        this._getStatus();
        this._trackId = {};
        this._getMetadata();
        this._currentTime = 0;
        this._getPosition();

        this._prop.connect('PropertiesChanged', Lang.bind(this, function(sender, iface, value) {
            if (value["PlaybackStatus"])
                this._setStatus(iface, value["PlaybackStatus"]);
            if (value["Metadata"])
                this._setMetadata(iface, value["Metadata"]);
        }));

        this._mediaServerPlayer.connect('Seeked', Lang.bind(this, function(sender, value) {
            this._setPosition(sender, value);
        }));
        
        Mainloop.timeout_add(1000, Lang.bind(this, this._getPosition));
    },

    _getName: function() {
        return this._name.charAt(0).toUpperCase() + this._name.slice(1);
    },


    _setName: function(status) {
        this._playerInfo.setText(this._getName() + " - " + _(status));
    },

    _formatTrackInfo: function(text) {
        text = text.toString();
        if (text.length > 25) {
            text = text.substr(0, 25) + "...";
        }
        return text;
    },

    _setPosition: function(sender, value) {
        this._stopTimer();
        this._currentTime = value / 1000000;
        this._updateTimer();
        if (this._playerStatus == "Playing")
            this._runTimer();
    },

    _getPosition: function() {
        this._mediaServerPlayer.getPosition(Lang.bind(this, 
            this._setPosition
        ));
        Mainloop.timeout_add(1000, Lang.bind(this, this._getPosition));
    },

    _setMetadata: function(sender, metadata) {
        if (metadata["mpris:length"]) {
            // song length in secs
            this._songLength = metadata["mpris:length"] / 1000000;
            // FIXME upstream
            if (this._name == "quodlibet")
                this._songLength = metadata["mpris:length"] / 1000;
            // reset timer
            this._stopTimer();
            if (this._playerStatus == "Playing")
                this._runTimer();
        }
        else {
            this._songLength = 0;
            this._stopTimer();
        }
        if (metadata["xesam:artist"])
            this._artist.setLabel(this._formatTrackInfo(metadata["xesam:artist"]));
        else
            this._artist.setLabel(_("Unknown Artist"));
        if (metadata["xesam:album"])
            this._album.setLabel(this._formatTrackInfo(metadata["xesam:album"]));
        else
            this._album.setLabel(_("Unknown Album"));
        if (metadata["xesam:title"])
            this._title.setLabel(this._formatTrackInfo(metadata["xesam:title"]));
        else
            this._title.setLabel(_("Unknown Title"));
        /*if (metadata["mpris:trackid"]) {
            this._trackId = {
                _init: function() {
                    DBus.session.proxifyObject(this, this._owner, metadata["mpris:trackid"]);
                }
            }
        }*/

        if (metadata["mpris:artUrl"]) {
            let cover = metadata["mpris:artUrl"].toString();
            cover = decodeURIComponent(cover.substr(7));
            if (! GLib.file_test(cover, GLib.FileTest.EXISTS))
                this._trackCover.set_child(new St.Icon({icon_name: "media-optical-cd-audio", icon_size: 100, icon_type: St.IconType.FULLCOLOR}));
            else {
                let l = new Clutter.BinLayout();
                let b = new Clutter.Box();
                let c = new Clutter.Texture({height: 100, keep_aspect_ratio: true, filter_quality: 2, filename: cover});
                b.set_layout_manager(l);
                b.set_width(120);
                b.add_actor(c);
                this._trackCover.set_child(b);
            }
        }
        else
            this._trackCover.set_child(new St.Icon({icon_name: "media-optical-cd-audio", icon_size: 100, icon_type: St.IconType.FULLCOLOR}));
    },

    _getMetadata: function() {
        this._mediaServerPlayer.getMetadata(Lang.bind(this,
            this._setMetadata
        ));
    },

    _setStatus: function(sender, status) {
        this._playerStatus = status;
        if (status == "Playing") {
            this._playButton.setIcon("media-playback-pause");
            this._runTimer();
        }
        else if (status == "Paused") {
            this._playButton.setIcon("media-playback-start");
            this._pauseTimer(); 
        }
        else if (status == "Stopped") {
            this._playButton.setIcon("media-playback-start");
            this._stopTimer();
        }
        this._playerInfo.setImage("player-" + status.toLowerCase());
        this._setName(status);
    },

    _getStatus: function() {
        this._mediaServerPlayer.getPlaybackStatus(Lang.bind(this,
            this._setStatus
        ));
    },

    _updateRate: function() {
        this._mediaServerPlayer.getRate(Lang.bind(this, function(sender, rate) {
            this._rate = rate;
        }));
    },

    _updateTimer: function() {
        this._time.setLabel(this._formatTime(this._currentTime) + " / " + this._formatTime(this._songLength));
    },

    _runTimer: function() {
        /*if (!Tweener.resumeTweens(this)) {
            Tweener.addTween(this,
                { time: this._songLength - this._currentTime,
                  transition: 'linear',
                  onUpdate: Lang.bind(this, this._updateTimer) });
        }*/
    },

    _pauseTimer: function() {
        //Tweener.pauseTweens(this);
    },

    _stopTimer: function() {
        /*Tweener.removeTweens(this);
        this._currentTime = 0;
        this._updateTimer();*/
    },

    _formatTime: function(s) {
        let ms = s * 1000;
        let msSecs = (1000);
        let msMins = (msSecs * 60);
        let msHours = (msMins * 60);
        let numHours = Math.floor(ms/msHours);
        let numMins = Math.floor((ms - (numHours * msHours)) / msMins);
        let numSecs = Math.floor((ms - (numHours * msHours) - (numMins * msMins))/ msSecs);
        if (numSecs < 10)
            numSecs = "0" + numSecs.toString();
        if (numMins < 10 && numHours > 0)
            numMins = "0" + numMins.toString();
        if (numHours > 0)
            numHours = numHours.toString() + ":";
        else
            numHours = "";
        return numHours + numMins.toString() + ":" + numSecs.toString();
    },
    
    setIcon: function(icon) {
       if (this._system_status_button._nbPlayers()==0)
         this._system_status_button.setIcon(icon);
       else
         this._system_status_button.setIcon('audio-x-generic');
    }

}

function MediaPlayerLauncher(app, menu) {
    this._init(app, menu);
}

MediaPlayerLauncher.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function (app, menu) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {});

        this._app = app;
        this._menu = menu;
        this.label = new St.Label({ text: app.get_name() });
        this.addActor(this.label);
        this._icon = app.create_icon_texture(ICON_SIZE);
        this.addActor(this._icon, { expand: false });
    },

    activate: function (event) {
    	this._menu.actor.hide();
        this._app.activate_full(-1, event.get_time());        
        return true;
    }

};

function MyApplet(orientation) {
    this._init(orientation);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(orientation) {        
        Applet.IconApplet.prototype._init.call(this, orientation);
        
        try {                                
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);            
            
            this.set_applet_icon_symbolic_name('audio-x-generic');
            
            // menu not showed by default
            this._players = {};
            // watch players
            for (var p=0; p<compatible_players.length; p++) {
                DBus.session.watch_name('org.mpris.MediaPlayer2.'+compatible_players[p], false,
                    Lang.bind(this, this._addPlayer),
                    Lang.bind(this, this._removePlayer)
                );
            }
            
            this._control = new Gvc.MixerControl({ name: 'Cinnamon Volume Control' });
            this._control.connect('state-changed', Lang.bind(this, this._onControlStateChanged));
            this._control.connect('default-sink-changed', Lang.bind(this, this._readOutput));
            this._control.connect('default-source-changed', Lang.bind(this, this._readInput));
            this._control.connect('stream-added', Lang.bind(this, this._maybeShowInput));
            this._control.connect('stream-removed', Lang.bind(this, this._maybeShowInput));
            this._volumeMax = 1.5*this._control.get_vol_max_norm();
            
            this._output = null;
            this._outputVolumeId = 0;
            this._outputMutedId = 0;

            this._input = null;
            this._inputVolumeId = 0;
            this._inputMutedId = 0;
            
            this._icon_name = '';
            
            this.actor.connect('scroll-event', Lang.bind(this, this._onScrollEvent));
            
            this._control.open();
            
            this._volumeControlShown = false;
            
            this._showFixedElements();
            
            
        }
        catch (e) {
            global.logError(e);
        }
    },
    
    on_applet_clicked: function(event) {
        this.menu.toggle();        
    },
    
    _onScrollEvent: function(actor, event) {
        let direction = event.get_scroll_direction();
        let currentVolume = this._output.volume;

        if (direction == Clutter.ScrollDirection.DOWN) {
            let prev_muted = this._output.is_muted;
            this._output.volume = Math.max(0, currentVolume - this._volumeMax * VOLUME_ADJUSTMENT_STEP);
            if (this._output.volume < 1) {
                this._output.volume = 0;
                if (!prev_muted)
                    this._output.change_is_muted(true);
            }
            this._output.push_volume();
        }
        else if (direction == Clutter.ScrollDirection.UP) {
            this._output.volume = Math.min(this._volumeMax, currentVolume + this._volumeMax * VOLUME_ADJUSTMENT_STEP);
            this._output.change_is_muted(false);
            this._output.push_volume();
        }

        this._notifyVolumeChange();
    },
    
    setIconName: function(icon) {
       this._icon_name = icon;
       if (this._nbPlayers()==0)
         this.set_applet_icon_symbolic_name(icon);
       else
         this.set_applet_icon_symbolic_name('audio-x-generic');
    },

    _nbPlayers: function() {
        return Object.keys(this._players).length;
    },

    _addPlayer: function(owner) {
        // ensure menu is empty
        this._cleanup();
        this._volumeControlShown = false;
        this._players[owner] = new Player(this, owner);
        this.menu.addMenuItem(this._players[owner]);
        this.menu.emit('players-loaded', true);
        
        this._showFixedElements();
        
        this.setIconName(this._icon_name);
        
        this._readOutput();
    },

    _removePlayer: function(owner) {
        delete this._players[owner];
        this._cleanup();
        this._volumeControlShown = false;
        for (owner in this._players) { 
            this._addPlayer(owner);
        }
        this.menu.emit('players-loaded', true);
        
        this._showFixedElements();
        
        this.setIconName(this._icon_name);
        
        this._readOutput();
    },
    
    _cleanup: function() {
        if (this._outputTitle) this._outputTitle.destroy();
        if (this._outputSlider) this._outputSlider.destroy();
        if (this._inputTitle) this._inputTitle.destroy();
        if (this._inputSlider) this._inputSlider.destroy();
        this.menu.removeAll();
     },
    
    _showFixedElements: function() {
        if (this._volumeControlShown) return;
        this._volumeControlShown = true;
        
        if (this._nbPlayers()==0){
        	this._availablePlayers = new Array();
            let appsys = Cinnamon.AppSystem.get_default();
            let allApps = appsys.get_all();
            let listedDesktopFiles = new Array();
            for (let y=0; y<allApps.length; y++) {
            	let app = allApps[y];
            	let entry = app.get_tree_entry();
            	let path = entry.get_desktop_file_path();
            	for (var p=0; p<compatible_players.length; p++) {
                    let desktopFile = compatible_players[p]+".desktop";
            		if (path.indexOf(desktopFile) != -1 && listedDesktopFiles.indexOf(desktopFile) == -1) {            		
                		this._availablePlayers.push(app);
                        listedDesktopFiles.push(desktopFile);
            		}
           		}            	        
            }                                   
            
            if (this._availablePlayers.length > 0){
                this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
                this._launchPlayerItem = new PopupMenu.PopupSubMenuMenuItem(_("Launch player..."));
                
                for (var p=0; p<this._availablePlayers.length; p++){
                    let playerApp = this._availablePlayers[p];
                    let menuItem = new MediaPlayerLauncher(playerApp, this._launchPlayerItem.menu);
                    this._launchPlayerItem.menu.addMenuItem(menuItem);
                }
                
                this.menu.addMenuItem(this._launchPlayerItem);
            }
        }
        
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._outputTitle = new TextImageMenuItem(_("Volume"), "audio-volume-high", false, "right", "sound-volume-menu-item");
        this._outputSlider = new PopupMenu.PopupSliderMenuItem(0);
        this._outputSlider.connect('value-changed', Lang.bind(this, this._sliderChanged, '_output'));
        this._outputSlider.connect('drag-end', Lang.bind(this, this._notifyVolumeChange));
        this.menu.addMenuItem(this._outputTitle);
        this.menu.addMenuItem(this._outputSlider);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._inputTitle = new PopupMenu.PopupMenuItem(_("Microphone"), { reactive: false });
        this._inputSlider = new PopupMenu.PopupSliderMenuItem(0);
        this._inputSlider.connect('value-changed', Lang.bind(this, this._sliderChanged, '_input'));
        this._inputSlider.connect('drag-end', Lang.bind(this, this._notifyVolumeChange));
        this.menu.addMenuItem(this._inputTitle);
        this.menu.addMenuItem(this._inputSlider);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());               
        this.menu.addSettingsAction(_("Sound Settings"), 'gnome-sound-panel.desktop');
        
        this._selectDeviceItem = new PopupMenu.PopupSubMenuMenuItem(_("Output device..."));
        this.menu.addMenuItem(this._selectDeviceItem);     
        
        if (this._showInput){
           this._inputTitle.actor.show();
           this._inputSlider.actor.show();
        }else{
           this._inputTitle.actor.hide();
           this._inputSlider.actor.hide();
        }
        
        this._volumeChanged (null, null, '_output');
        this._volumeChanged (null, null, '_input');
    },
    
    _sliderChanged: function(slider, value, property) {
        if (this[property] == null) {
            log ('Volume slider changed for %s, but %s does not exist'.format(property, property));
            return;
        }
        let volume = value * this._volumeMax;
        let prev_muted = this[property].is_muted;
        if (volume < 1) {
            this[property].volume = 0;
            if (!prev_muted)
                this[property].change_is_muted(true);
        } else {
            this[property].volume = volume;
            if (prev_muted)
                this[property].change_is_muted(false);
        }
        this[property].push_volume();
    },

    _notifyVolumeChange: function() {
        global.cancel_theme_sound(VOLUME_NOTIFY_ID);
        global.play_theme_sound(VOLUME_NOTIFY_ID, 'audio-volume-change');
    },

    _mutedChanged: function(object, param_spec, property) {
        let muted = this[property].is_muted;
        let slider = this[property+'Slider'];
        slider.setValue(muted ? 0 : (this[property].volume / this._volumeMax));
        if (property == '_output') {
            if (muted)
                this.setIconName('audio-volume-muted');
            else
                this.setIconName(this._volumeToIcon(this._output.volume));
        }
    },

    _volumeChanged: function(object, param_spec, property) {
        if (this[property] == null) return;
        if (this[property].volume / this._volumeMax === 0)
            this._outputTitle.setIcon("audio-volume-muted");
        if (this[property].volume / this._volumeMax > 0)
            this._outputTitle.setIcon("audio-volume-low");
        if (this[property].volume / this._volumeMax > 0.30) 
            this._outputTitle.setIcon("audio-volume-medium");
        if (this[property].volume / this._volumeMax > 0.80)
            this._outputTitle.setIcon("audio-volume-high");
        this[property+'Slider'].setValue(this[property].volume / this._volumeMax);
        if (property == '_output' && !this._output.is_muted)
            this.setIconName(this._volumeToIcon(this._output.volume));
    },
    
    _volumeToIcon: function(volume) {
        if (volume <= 0) {
            return 'audio-volume-muted';
        } else {
            let n = Math.floor(3 * volume / this._volumeMax) + 1;
            if (n < 2)
                return 'audio-volume-low';
            if (n >= 3)
                return 'audio-volume-high';
            return 'audio-volume-medium';
        }
    },
    
    _onControlStateChanged: function() {
        if (this._control.get_state() == Gvc.MixerControlState.READY) {
            this._readOutput();
            this._readInput();
            this.actor.show();
        } else {
            this.actor.hide();
        }
    },
    
    _readOutput: function() {
        if (this._outputVolumeId) {
            this._output.disconnect(this._outputVolumeId);
            this._output.disconnect(this._outputMutedId);
            this._outputVolumeId = 0;
            this._outputMutedId = 0;
        }
        this._output = this._control.get_default_sink();
        if (this._output) {
            this._outputMutedId = this._output.connect('notify::is-muted', Lang.bind(this, this._mutedChanged, '_output'));
            this._outputVolumeId = this._output.connect('notify::volume', Lang.bind(this, this._volumeChanged, '_output'));
            this._mutedChanged (null, null, '_output');
            this._volumeChanged (null, null, '_output');
            let sinks = this._control.get_sinks();           
	        this._selectDeviceItem.menu.removeAll();                
	        for (let i = 0; i < sinks.length; i++) {
	        	let sink = sinks[i];
	        	let menuItem = new PopupMenu.PopupMenuItem(sink.get_description());
	        	if (sinks[i].get_id() == this._output.get_id()) {
	        		menuItem.setShowDot(true);
	        	}
	        	menuItem.connect('activate', Lang.bind(this, function() {
	        		log('Changing default sink to ' + sink.get_description());
	                this._control.set_default_sink(sink);
	            }));        	        	       
	            this._selectDeviceItem.menu.addMenuItem(menuItem);             
	        }            
        } else {
            this._outputSlider.setValue(0);
            this.setIconName('audio-volume-muted-symbolic');
        }        
    },
            
    _readInput: function() {
        if (this._inputVolumeId) {
            this._input.disconnect(this._inputVolumeId);
            this._input.disconnect(this._inputMutedId);
            this._inputVolumeId = 0;
            this._inputMutedId = 0;
        }
        this._input = this._control.get_default_source();
        if (this._input) {
            this._inputMutedId = this._input.connect('notify::is-muted', Lang.bind(this, this._mutedChanged, '_input'));
            this._inputVolumeId = this._input.connect('notify::volume', Lang.bind(this, this._volumeChanged, '_input'));
            this._mutedChanged (null, null, '_input');
            this._volumeChanged (null, null, '_input');
        } else {
            this._inputTitle.actor.hide();
            this._inputSlider.actor.hide();
        }
    },
    
    _maybeShowInput: function() {
        // only show input widgets if any application is recording audio
        this._showInput = false;
        let recordingApps = this._control.get_source_outputs();
        if (this._input && recordingApps) {
            for (let i = 0; i < recordingApps.length; i++) {
                let outputStream = recordingApps[i];
                let id = outputStream.get_application_id();
                // but skip gnome-volume-control and pavucontrol
                // (that appear as recording because they show the input level)
                if (!id || (id != 'org.gnome.VolumeControl' && id != 'org.PulseAudio.pavucontrol')) {
                    this._showInput = true;
                    break;
                }
            }
        }
        if (this._showInput) {
            this._inputTitle.actor.show();
            this._inputSlider.actor.show();
        } else {
            this._inputTitle.actor.hide();
            this._inputSlider.actor.hide();
        }
    }
    
};

function main(metadata, orientation) {  
    let myApplet = new MyApplet(orientation);
    return myApplet;      
}
