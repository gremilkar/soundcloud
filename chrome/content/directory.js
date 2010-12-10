/*
Copyright (c) 2010, Pioneers of the Inevitable, Inc.
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

  * Redistributions of source code must retain the above copyright notice,
  this list of conditions and the following disclaimer.
  * Redistributions in binary form must reproduce the above copyright notice,
  this list of conditions and the following disclaimer in the documentation
  and/or other materials provided with the distribution.
  * Neither the name of Pioneers of the Inevitable, Songbird, nor the names
  of its contributors may be used to endorse or promote products derived
  from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

var Cc = Components.classes;
var Ci = Components.interfaces;
var Cu = Components.utils;

Cu.import("resource://app/jsmodules/DOMUtils.jsm");
Cu.import("resource://app/components/kPlaylistCommands.jsm");
Cu.import("resource://app/jsmodules/sbLibraryUtils.jsm");
Cu.import("resource://app/jsmodules/sbProperties.jsm");

if (typeof(mainWindow) == "undefined")
  var mainWindow = Cc["@mozilla.org/appshell/window-mediator;1"]
                     .getService(Ci.nsIWindowMediator)
                     .getMostRecentWindow("Songbird:Main").window;

if (typeof(gBrowser) == "undefined")
  var gBrowser = Cc["@mozilla.org/appshell/window-mediator;1"]
                   .getService(Ci.nsIWindowMediator)
                   .getMostRecentWindow("Songbird:Main").window.gBrowser;

if (typeof(ioService) == "undefined")
  var ioService = Cc["@mozilla.org/network/io-service;1"]
                    .getService(Ci.nsIIOService);

if (typeof(gMetrics) == "undefined")
  var gMetrics = Cc["@songbirdnest.com/Songbird/Metrics;1"]
                   .createInstance(Ci.sbIMetrics);

const initialized = "extensions.soundcloud.library.init";

if (typeof CloudDirectory == "undefined") {
  var CloudDirectory = {};
}

CloudDirectory.onLoad = function() {
  var self = this;
  this.tracksFound = 0;

  this._strings = Cc["@mozilla.org/intl/stringbundle;1"]
                    .getService(Ci.nsIStringBundleService)
                    .createBundle("chrome://soundcloud/locale/overlay.properties");

  // Set the tab title
  document.title = this._strings.GetStringFromName("radioTabTitle");

  this._service = Cc['@songbirdnest.com/soundcloud;1']
                    .getService().wrappedJSObject;

  this._domEventListenerSet = new DOMEventListenerSet();

  // Wire up UI events
  this._logo = document.getElementById("soundcloud-logo");
  var onLogoClicked = function() { gBrowser.loadOneTab("http://soundcloud.com"); };
  this._domEventListenerSet.add(this._logo,
                                'click',
                                onLogoClicked,
                                false,
                                false);

  this._searchBox = document.getElementById("soundcloud-search-textbox");
  this._searchBtn = document.getElementById("soundcloud-search-btn");

  var onSearchInput = function(aEvent) {
    self._searchBtn.disabled = aEvent.target.value.length == 0;
  };

  var onSearchKeydown = function(aEvent) {
    if (aEvent.keyCode == KeyEvent.DOM_VK_RETURN ||
        aEvent.keyCode == KeyEvent.DOM_VK_ENTER)
      self._searchBtn.click();
  };

  var onSearchCommand = function() { self.triggerSearch(); };

  this._domEventListenerSet.add(this._searchBox,
                                'input',
                                onSearchInput,
                                false,
                                false);
  this._domEventListenerSet.add(this._searchBox,
                                'keydown',
                                onSearchKeydown,
                                false,
                                false);
  this._domEventListenerSet.add(this._searchBtn,
                                'command',
                                onSearchCommand,
                                false,
                                false);

  // Setup library
  this._library = this._service.library;

  // Bind the playlist widget to our library
  this._directory = document.getElementById("soundcloud-directory");
  this._directory.bind(this._library.createView());

  // If this is the first time we've loaded the playlist, clear the 
  // normal columns and use the soundcloud ones
  if (!Application.prefs.getValue(initialized, false)) {
    Application.prefs.setValue(initialized, true);
    var colSpec = SOCL_title + " 358 " + SOCL_time + " 71 " +
                  SOCL_user + " 150 " + SOCL_plays + " 45 " +
                  SOCL_favs + " 45 ";// + SOCL_url + " 290 ";
    this._library.setProperty(SBProperties.columnSpec, colSpec);
    this._directory.clearColumns();
    this._directory.appendColumn(SOCL_title, "358");
    this._directory.appendColumn(SOCL_time, "71");
    this._directory.appendColumn(SOCL_user, "150");
    this._directory.appendColumn(SOCL_plays, "45");
    this._directory.appendColumn(SOCL_favs, "45");
    //this._directory.appendColumn(SOCL_dl, "60");
    //this._directory.appendColumn(SOCL_url, "290");  
  }
}

CloudDirectory.addTracksToLibrary = function(tracks) {
  // Make the progress meter spin
  var el = mainWindow.document
                     .getElementById("sb-status-bar-status-progressmeter");
  el.mode = "undetermined";
 
  if (tracks != null) {
    var trackArray = Cc["@songbirdnest.com/moz/xpcom/threadsafe-array;1"]
                       .createInstance(Ci.nsIMutableArray);
    var propertiesArray = Cc["@songbirdnest.com/moz/xpcom/threadsafe-array;1"]
                            .createInstance(Ci.nsIMutableArray);

    for (var i=0; i < tracks.length; i++) {
      var title = tracks[i].title;
      var duration = tracks[i].duration * 1000;
      var username = tracks[i].user.username;
      var pcount = tracks[i].playback_count;
      var fcount = tracks[i].favoritings_count;
      var uri = tracks[i].uri;
      var streamURL = tracks[i].stream_url;
      var streamable = tracks[i].streamable;
      var downloadable = tracks[i].downloadable;

      if (!streamable)
        continue;

      var props =
        Cc["@songbirdnest.com/Songbird/Properties/MutablePropertyArray;1"]
          .createInstance(Ci.sbIMutablePropertyArray);

      props.appendProperty(SOCL_title, title);
      props.appendProperty(SOCL_time, duration);
      props.appendProperty(SOCL_user, username);
      props.appendProperty(SOCL_plays, pcount);
      props.appendProperty(SOCL_favs, fcount);
      /*
      if (downloadable) {
      var downloadURL = tracks[i].download_url;
      props.appendProperty("http://songbirdnest.com/data/1.0#downloadURL", downloadURL);
      props.appendProperty(SOCL_dl, "1|0|0");
      trackArray.appendElement(ioService.newURI(downloadURL, null, null),
                               false);
      } else {
      */
      trackArray.appendElement(ioService.newURI(streamURL, null, null),
                               false);
      propertiesArray.appendElement(props, false);
    }

    CloudDirectory._library.batchCreateMediaItemsAsync(libListener,
                                                       trackArray, 
                                                       propertiesArray,
                                                       false);
    /*
    var deck = document.getElementById("loading-deck");
    deck.selectedIndex = 1;
    */
  }
}

CloudDirectory.getTracksFound = function() {
  return this.tracksFound;
}

CloudDirectory.setTracksFound = function(tracks) {
  this.tracksFound += tracks;
}

CloudDirectory.resetTracksFound = function() {
  this.tracksFound = 0;
}

CloudDirectory.triggerSearch = function(event) {
  // Reset the library
  this._library.clear();
  this.resetTracksFound();
  var query = encodeURIComponent(this._searchBox.value);
  this.getTracks(query, 0);
}

CloudDirectory.getTracks = function(query, offset) {
  var self = this;
  // Get value from search textbox
  var flags = {
    "query": query,
    "offset": offset,
    "order": "hotness"
  };
  var onCallback = function(success, json) {
    let tracks = JSON.parse(json);
    let next = tracks.length + offset;
    self.addTracksToLibrary(tracks);
    if (tracks.length > 40) {
      self.getTracks(query, next);
    }
  };
  this._service.apiCall("tracks", flags, onCallback);
}

CloudDirectory.onUnload = function() {
  if (this._domEventListenerSet) {
    this._domEventListenerSet.removeAll();
    this._domEventListenerSet = null;
  }
}

var libListener = {
  onProgress: function(i) {},
  onComplete: function(array, result) {
  // Reset the progress meter
  var el = mainWindow.document
                     .getElementById("sb-status-bar-status-progressmeter");
  el.mode = "";
  CloudDirectory.setTracksFound(array.length);

  SBDataSetStringValue("faceplate.status.type",
             "playable");
				
  SBDataSetStringValue("faceplate.status.override.text",
                       CloudDirectory.getTracksFound() + " " +
                       CloudDirectory._strings.getStringFromName("tracksFound"));
  }
}
