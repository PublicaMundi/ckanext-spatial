var $_ = _ // keep pointer to underscore, as '_' will be overridden by a closure variable when down the stack


this.ckan.module('olpreview2', function (jQuery, _) {
    var proxy = false;
    var GEOSERVER_URL = "http://labs.geodata.gov.gr/geoserver";
    var GEOSERVER_URL_ALT = "http://geoserver.dev.publicamundi.eu:8080/geoserver";
   
     
    var parseWFSCapas = function(resource, url, callback, failCallback) {
        console.log(url);
        //url = url.split('?')[0]
        //var parsedUrl = resource.url.split('#')
        //$.ajax(url+"?service=WFS&request=GetCapabilities").then(function(response) {
         $.ajax({
                type: "GET",
                url: url+"?service=WFS&request=GetCapabilities",
                async: true, 
                beforeSend: function(){
                    console.log('loading...');
                    $('.loading-spinner').css({'display':'block'});
                },
                complete: function(){
                    console.log('finished loading.');
                    $('.loading-spinner').css({'display':'none'});
                },
                success: function(response) {
                    console.log('succeeded');
            
                    response = xmlToJson(response);
                    console.log(response);
                    var candidates = response["wfs:WFS_Capabilities"]["FeatureTypeList"];
                    if (typeof candidates === "undefined") {
                        candidates = response["wfs:WFS_Capabilities"]["wfs:FeatureTypeList"]["wfs:FeatureType"];
                    }
                    else{ 
                        candidates = candidates["FeatureType"];
                    }
                    var version = response["wfs:WFS_Capabilities"]["@attributes"]["version"];
                    
                    var format_vals = response["wfs:WFS_Capabilities"]["ows:OperationsMetadata"]["ows:Operation"];
                
                    // Check output formats
                    getValue(format_vals, "outputFormat");

                    var format;
                    // If json or application/json found in outputFormat then use that, else select gml based on version
                    if (outputFormat.indexOf('json') > -1 || outputFormat.indexOf('application/json') > -1){
                        format = 'json';
                    }
                    else if (version == '1.1.0'){
                        format = 'gml3';
                    }
                    else if (version == '1.0.0'){
                        format = 'gml2';
                    }


                    // In case the url shows to our geoserver look for the specific resource layer name (publicamundi:xxxxx)
                    if (resource.url.startsWith(GEOSERVER_URL) || resource.url.startsWith(GEOSERVER_URL_ALT)){
                        console.log('PublicaMundi GEOSERVER');
                            var found = false;
                            $_.each(candidates, function(candidate, idx) {
                                if (candidate["Name"]["#text"] == resource.wfs_layer){
                                    candidates = candidate;
                                    found = true;
                                    return false;
                                }
                            });
                            if (found == false){
                                console.log('oops..layer not found, something wrong here...');
                            }
                        
                        };

                    callback(candidates, version, format);
                },

                failure: function(response) {
                    console.log('failed');
                    console.log(response);
                }
            
         });


    }

    var withFeatureTypesLayers = function (resource, layerProcessor) {
        console.log('wfs');
        console.log(resource);
        
        var parsedUrl = resource.url.split('#')
        var url = resource.proxy_service_url || parsedUrl[0]
        var ftName = parsedUrl.length>1 && parsedUrl[1]

        parseWFSCapas(
            resource,
            url,
            function(candidates, version, format) {
                var count = candidates.length;

                $_.each(candidates, function(candidate, idx) {
                    
                    
                    var name = candidate["Name"];
                    if (typeof name === "undefined") {
                        name = candidate["wfs:Name"];
                    }
                    name = name["#text"];
                        
                    var title = resource.name;
                    if (candidate["Title"]){
                        title = candidate["Title"]["#text"];
                    }
                    else if (candidate["wfs:Title"]){
                        title = candidate["wfs:Title"]["#text"];
                    }
                    
                    var bbox = null;
                    var bboxfloat = null;
                    if (candidate["WGS84BoundingBox"]){
                        bbox = candidate["WGS84BoundingBox"];
                        var lc = bbox['LowerCorner']["#text"];
                        var uc = bbox['UpperCorner']["#text"];
                        
                        lc = lc.split(' ');
                        uc = uc.split(' ');
                        bboxfloat = [ parseFloat(lc[0]), parseFloat(lc[1]), parseFloat(uc[0]), parseFloat(uc[1]) ];
                    }
                    else if (candidate["ows:WGS84BoundingBox"]){
                            bbox = candidate["ows:WGS84BoundingBox"];
                            var lc = bbox['ows:LowerCorner']["#text"];
                            var uc = bbox['ows:UpperCorner']["#text"];
                            
                            lc = lc.split(' ');
                            uc = uc.split(' ');
                            bboxfloat = [ parseFloat(lc[0]), parseFloat(lc[1]), parseFloat(uc[0]), parseFloat(uc[1]) ];
                    }
                    
                    var crs = null;
                    if (candidate["DefaultCRS"]){
                        var crs_raw = candidate["DefaultCRS"]["#text"];
                        var crs_arr = crs_raw.split(":");
                        crs = crs_arr[crs_arr.length-3]+":"+crs_arr[crs_arr.length-1];
                    }
                    
                    var visibility = false;
                // If only 1 layer available then make it visible on load
                if (count == 1){
                    visibility = true;
                }
               
                // If there is a layer that matches part of the resource title then make it visible on load
                if (resource.name.startsWith(title)){
                    visibility = true;
                }


                var ftLayer = { 
                    name: name,
                    title: title,
                    visible: visibility,
                    type: PublicaMundi.LayerType.WFS,
                    click: onFeatureClick,
                    url: url,
                    bbox: bboxfloat,
                    params: { 
                            'format': format,
                            'version': version,
                            'layers': name, 
                            //'projection': crs,
                            //'maxFeatures': '10',
                    } 
                };
            
                layerProcessor(ftLayer)
        
                })
        
             })
}

    var parseWMSCapas = function(resource, url, callback, failCallback) {
       
        //TODO: implement without using ol.format (see WFS parsing)
        var parser = new ol.format.WMSCapabilities();
        
        console.log(url);
        
        $.ajax({
                type: "GET",
                url: url+"?service=WMS&request=GetCapabilities",
                async: true, 
                beforeSend: function(){
                    console.log('loading...');
                    $('.loading-spinner').css({'display':'block'});
                },
                complete: function(){
                    console.log('finished loading.');
                    $('.loading-spinner').css({'display':'none'});

                },
                success: function(response) {
                    console.log('succeeded');

                    var response = parser.read(response);
                    //console.log(response);
                    var version = response["version"];
                    var candidates = response["Capability"]["Layer"]["Layer"];
                    
                    if (resource.url.startsWith(GEOSERVER_URL) || resource.url.startsWith(GEOSERVER_URL_ALT)){
                        console.log('PublicaMundi GEOSERVER');
                            var found = false;
                            $_.each(candidates, function(candidate, idx) {
                                if (candidate["Name"] == resource.wms_layer){
                                    candidates = candidate;
                                    found = true;
                                    return false;
                                }
                            });
                            if (found == false){
                                console.log('oops..layer not found, something wrong here...');
                            }
                        };

                    callback(candidates, version);
                },

                failure: function(response) {
                    console.log('failed');
                    console.log(response);
                }


        });
    }

    var withWMSLayers = function (resource, layerProcessor) {
        
        var parsedUrl = resource.url.split('#')
        var urlBody = parsedUrl[0].split('?')[0] // remove query if any
        var url = resource.proxy_service_url || urlBody

        var layerName = parsedUrl.length>1 && parsedUrl[1]
       
        parseWMSCapas(
            resource,
            url,
            function(candidates, version) {
                var count = candidates.length;

                    // Parse each WMS layer found
                    $_.each(candidates, function(candidate, idx) {
                        
                        var name = candidate["Name"];
                        var title = resource.name;
                        if(candidate["Title"]){
                            title = candidate["Title"];
                        }
                        var bbox = null;
                        var bboxfloat = null;
                        if (candidate["BoundingBox"]){
                            bbox = candidate["BoundingBox"];
                            bboxfloat = extractBbox(bbox);
                        }

                        var visibility = false;
                        // If only 1 layer available then make it visible on load
                        if (count == 1){
                            visibility = true;
                        }
                    
                        // If there is a layer that matches part of the resource title then make it visible on load
                        else if (resource.name.startsWith(title)){
                            visibility = true;
                        }
                       
                        var mapLayer = {
                            type: PublicaMundi.LayerType.WMS,
                            url: urlBody, // use the original URL for the getMap, as there's no need for a proxy for image request
                            name: name,
                            title: title,
                            bbox: bboxfloat,
                            visible: visibility,
                            params: {'layers': name,
                                     //'TRANSPARENT': 'TRUE',
                                    'VERSION': version
                            
                            },
                        };

                        layerProcessor(mapLayer)
                        })

                    }
                )

        }
    
    var createKMLLayer = function (resource) {
        var url = resource.proxy_url || resource.url

        var kml = {
                title: 'KML',
                type: PublicaMundi.LayerType.KML,
                url: url,
                click: onFeatureClick
        }

        return kml;
    }


    var createGMLLayer = function (resource) {
        var url = resource.proxy_url || resource.url
        
        var gml = {
            title: 'GML',
            featureNS: undefined,
            featureType: undefined,
            type: PublicaMundi.LayerType.GML,
            url: url,
            click: onFeatureClick,
        }
        return gml;
        //TODO styles

    }

 

    var createGeoJSONLayer = function (resource) {
        
        var url = resource.proxy_url || resource.url
        
        var geojson = {
            title: 'GeoJson',
            type: PublicaMundi.LayerType.GeoJSON,
            url: url,
            visible: false,
            click: onFeatureClick

        };

        //TODO add styles
        return geojson
    }

   

    var layerExtractors = {
        'kml': function(resource, layerProcessor) {layerProcessor(createKMLLayer(resource))},
        'gml': function(resource, layerProcessor) {layerProcessor(createGMLLayer(resource))},
        'geojson': function(resource, layerProcessor) {layerProcessor(createGeoJSONLayer(resource))},
        'wfs': withFeatureTypesLayers,
        'wms': withWMSLayers,
    }

    var withLayers = function(resource, layerProcessor) {
        var resourceUrl = resource.url
        var proxiedResourceUrl = resource.proxy_url
        var proxiedServiceUrl = resource.proxy_service_url

        var withLayers = layerExtractors[resource.format && resource.format.toLocaleLowerCase()]
        withLayers && withLayers(resource, layerProcessor)
    }

    //
    // Helper functions 
    //
    
    var outputFormat = [];
    function getValue(obj, value) {
        for (var key in obj) {
            if (obj.hasOwnProperty(key)) {
                if (obj[key]["name"] == value) {
                    getKey(obj, "#text");
                }

                else if ("object" == typeof(obj[key])) {
                    getValue(obj[key], value);
                }             }
        }
    }
    function getKey(obj, name){
        for (var key in obj) {
            if (obj.hasOwnProperty(key)) {
                if ("object" == typeof(obj[key])) {
                    getKey(obj[key], name);
                }
                else if (key == name){
                    outputFormat.push(obj[key]);
                }
            }
        }
    }

    String.prototype.startsWith = function(str){
        return this.indexOf(str) == 0;
    }

    var extractBbox = function (bbox) {
        var bboxtemp= null;
        //$_.each(candidates, function(candidate, idx) {
        $_.each(bbox, function(at, idx) {
            if(at["crs"] == "EPSG:4326") {
                bboxtemp = [ at["extent"][1], at["extent"][0], at["extent"][3], at["extent"][2] ];
                //return bboxfloat;
            }
            else if(at["crs"] == "CRS:84") {
                    bboxtemp = [ at["extent"][0], at["extent"][1], at["extent"][2], at["extent"][3] ];
                    //return bboxfloat;
                }
        });
        return bboxtemp;
    }

    
    // Handle click with overlay
    
    var popup;
    var onFeatureClick = function (features, pixel) {
            if (features) {
                feature = features [0];
            }
            
            if (popup) {
            var element = popup.getElement();
              var coordinate = pixel;
                  popup.setPosition(coordinate);
                
                  $(document.getElementById('popup')).popover('destroy');
                    
                    // Display name if found, else display full object if json, else display nothing
                    var text;
                    if (feature['name']) { 
                        text =feature['name'];
                    }
                    else //if (typeof(feature) == 'Object')
                    {
                        text = JSON.stringify(feature);
                    }
                    //else {
                    //    text = '';
                    //}
                    $(element).popover({
                            'placement': 'top',
                            'animation': true,
                            'html': true,
                            'content': text
                        }).attr('data-original-title');

                    $(element).popover('show');
            }
        };

    return {
       // options: {
       //     i18n: {
       //     }
       // },

        initialize: function () {
            jQuery.proxyAll(this, /_on/);
            this.el.ready(this._onReady);
        },

        addLayer: function(resourceLayer) {
            
            var layer = this.map.createLayer(resourceLayer);
            // set map extent on layer bounds
            layer.fitToMap();
        
        },

        _onReady: function () {

            $('.loading-spinner').css({'display':'none'});

            var mapDiv = $("<div></div>").attr("id", "map-ol").addClass("map")
            popup = $("<div></div>").attr("id", "popup")
            
            mapDiv.append(popup)
            $("#data-preview2").empty()
            $("#data-preview2").append(mapDiv)

            PublicaMundi.noConflict();
            
            var baseLayers = [{
                        title: 'Open Street Maps',
                        type: PublicaMundi.LayerType.TILE,
                        url: 'http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
            }];

            var options = {
                target: 'map-ol',
                center: [-985774, 4016449],
                zoom: 1.6,
                projection: 'EPSG:900913',
                layers: baseLayers,
                minZoom: 1,
                maxZoom: 18,
            };
            this.map = PublicaMundi.map(options);
            this.map.setLayerControl(this.map.getLayers()[0]);
                
            // Popup showing the position the user clicked
            // TODO: make this accessible through the API
            popup = this.map.addOverlay(document.getElementById('popup'));

            //popup = new ol.Overlay({
            //   element: document.getElementById('popup')
            //   });
            //   this.map._map.addOverlay(popup);
                
               $(document.getElementById('map-ol')).click(function() {
                    $(document.getElementById('popup')).popover('destroy');
            });
            
            withLayers(preload_resource, $_.bind(this.addLayer, this))
        }
    }
});
