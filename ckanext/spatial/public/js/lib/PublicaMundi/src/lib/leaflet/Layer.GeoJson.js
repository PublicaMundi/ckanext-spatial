﻿// <reference path="../../../jQuery/jquery-2.1.0.intellisense.js" />
/// <reference path="../../../Leaflet/leaflet-src.js" />

/// <reference path="../../PublicaMundi.js" />
/// <reference path="../Layer.js" />

(function (global, PublicaMundi, L, $) {
    if (typeof PublicaMundi === 'undefined') {
        return;
    }

    if (typeof L === 'undefined') {
        return;
    }
    

    PublicaMundi.define('PublicaMundi.Leaflet.Layer');
    var popup;
    PublicaMundi.Leaflet.Layer.GeoJson = PublicaMundi.Class(PublicaMundi.Layer, {
        _addToControl: function() { 
            if (this._map.getLayerControl()){
                this._map.getLayerControl().addOverlay(this._layer, this._options.title);
                }
            },
        // TODO: not yet supported
        fitToMap: function() {
            var layer = this;
           
             this._layer.on('layeradd', function() {
            });

        },


        initialize: function (options) {
            PublicaMundi.Layer.prototype.initialize.call(this, options);

            function highlightFeature(e) {
                   var layer = e.target;

                   layer.setStyle({
                        opacity: 1,
                        weight: 3,
                        color: '#3399CC',
                   });
                   if (!L.Browser.ie && !L.Browser.opera) {
                        layer.bringToFront();
                   }
                }
            var auto = this;
            function resetHighlight(e) {
                auto._layer.resetStyle(auto._map._highlight);
            }

            if (!PublicaMundi.isDefined(options.projection)) {
                // TODO : Resolve projection / reproject    
            }

            var onClick = null;
            if (PublicaMundi.isFunction(options.click)) {
                onClick = function (e) {
                    options.click([e.target.feature.properties], [e.latlng.lat * (6378137), e.latlng.lng* (6378137)]);
               
                if (map._highlight){
                    if (map._highlight !== e.target){
                        resetHighlight(e);
                        map._highlight = e.target;
                        highlightFeature(e);
                    }
                    else{
                    }
                }
                else{
                    map._highlight = e.target;
                    highlightFeature(e);
                }
                               
                };
                }
            
            this._layer = L.geoJson(null, {

                style: {
                    color: '#3399CC',
                    weight: 1.25,
                    opacity: 1,
                    fillColor: '#FFFFFF',
                    fillOpacity: 0.4
                }, 
                pointToLayer: function (feature, latlng) {
                    return L.circleMarker(latlng, {
                        radius: 5,
                        fillColor: '#FFFFFF',
                        fillOpacity: 0.4,
                        color: "#3399CC",
                        weight: 1.25,
                        opacity: 1
                    }); 
                    }, 
                 onEachFeature: function onEachFeature(feature, layer) {
                    if (PublicaMundi.isFunction(onClick)) {
                        layer.on({
                            click: onClick
                        });
                    //layer.bindPopup(feature.properties.name);    
                    }
                },
                
            });

            $.ajax({       
                type: "GET",
                url: options.url,
                dataType: 'json',
                async: true, 
                context: this,
                beforeSend: function(){
                    console.log('loading...');
                },
                complete: function(){
                    console.log('finished loading.');
                },
                success: function (response) {
                    console.log('succeeded');
                    this._layer.addData(response);
                    
                    // TODO: the following needs to be executed in fitToMap
                    // Leaflet fires layer add event for each feature in geojson
                    var currextent = this._layer.getBounds();
                    var southWest = currextent.getSouthWest();
                    var northEast = currextent.getNorthEast();
                    this._extent = [southWest.lng, southWest.lat, northEast.lng, northEast.lat];
                    
                    //this._map.setExtent(this._extent, 'EPSG:4326');
                },
                
                failure: function(response) {
                    console.log('failed');
                    console.log(response);
                }

            });
            
            
        },

    });

    PublicaMundi.registry.registerLayerType({
        layer: PublicaMundi.LayerType.GeoJSON,
        framework: PublicaMundi.Leaflet.Framework,
        type: 'PublicaMundi.Layer.GeoJson',
        factory: PublicaMundi.Leaflet.Layer.GeoJson
    });

    // Add utility methods
    if (PublicaMundi.isDefined(PublicaMundi.Map)) {
        PublicaMundi.Map.prototype.geoJSON = function (options) {
            switch (typeof options) {

            }
            options.type = options.type || PublicaMundi.LayerType.GeoJSON;

            this.createLayer(options);
        };
    }
})(window, window.PublicaMundi, L, jQuery);
