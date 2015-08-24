var $_ = _ // keep pointer to underscore, as '_' will be overridden by a closure variable when down the stack

this.ckan.module('olpreview2', function (jQuery, _) 
{
    var proxy = false;
    var GEOSERVER_URL = "/geoserver";
    var RASDAMAN_URL = "/rasdaman/ows/wms13"; 
    var KTIMA_URL = "http://gis.ktimanet.gr/wms";
    

    var parseWFSCapas = function(resource, url, callback, failCallback) 
    {
         // The input URL is supposed to be in it's canonical form, i.e. it should be a valid 
         // GetCapabilities WFS request.
         $.ajax({
                type: "GET",
                url: url,
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
                    
                    var base = null;
                    if (response["wfs:WFS_Capabilities"]){
                        base = response["wfs:WFS_Capabilities"];
                    }
                    else if (response["WFS_Capabilities"]){
                        base =response["WFS_Capabilities"];
                    }
                    else{
                        alert("WFS Capabilities error. Could not load layers.");
                        return false;
                    }
                        
                    var candidates = [];
                    if (base["FeatureTypeList"]){
                        candidates = base["FeatureTypeList"]["FeatureType"];
                    }
                    else if (base["wfs:FeatureTypeList"]) {
                        candidates = base["wfs:FeatureTypeList"]["wfs:FeatureType"];
                    }
                    else{
                        alert("No WFS Features provided in selected endpoint.");
                        return false;
                    }
                   
                    var version = null
                    if (base["@attributes"]){
                        version = base["@attributes"]["version"];
                    }
                   
                    var format_vals = null;
                    if (base["ows:OperationsMetadata"]){
                        format_vals = base["ows:OperationsMetadata"]["ows:Operation"];
                    }
                    else if (base["OperationsMetadata"]){
                        format_vals = base["OperationsMetadata"]["Operation"];
                    }
                
                    // Check output formats
                    getValue(format_vals, "outputFormat");

                    var format = null;
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
                    console.log('wfsserver');
                    console.log(resource.wfs_server);
                    if (resource.wfs_server){
                    //if (resource.url.startsWith(GEOSERVER_URL)){
                        console.log('PublicaMundi GEOSERVER');
                            var found = false;
                            $_.each(candidates, function(candidate, idx) {
                                if (candidate["Name"]["#text"] == resource.wfs_layer){
                                    candidates = [candidate];
                                    found = true;
                                    return false;
                                }
                            });
                            if (found == false){
                                console.log('oops..layer not found, something wrong here...');
                            }
                        
                        };
                    console.log(candidates);
                    callback(candidates, version, format);
                },

                failure: function(response) {
                    console.log('failed');
                    console.log(response);
                }
            
         });


    }

    var withFeatureTypesLayers = function (resource, layerProcessor) 
    {
        console.log('wfs');
        console.log(resource);
        
        var parsed_url = resource.url.split('#')
        var url_body = parsed_url[0].split('?')[0] // remove query if any
        var url = resource.proxy_service_url || parsed_url[0]
        var ftName = parsed_url.length > 1 && parsed_url[1]

        parseWFSCapas(
            resource,
            url,
            function(candidates, version, format) {
                var count = candidates.length;

                $_.each(candidates, function(candidate, idx) {
                    
                    var name = null;
                    if (candidate["Name"]){
                        name = candidate["Name"]["#text"];
                    }
                    else if (candidate["wfs:Name"]){
                        name = candidate["wfs:Name"]["#text"];
                    }
                    else{
                        alert("Layer has no name attribute. Cannot display");
                        return false;
                    }
                        
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
                        url: url_body,
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

    var parseWMSCapas = function(resource, url, callback, failCallback) 
    {
       
        //TODO: implement without using ol.format (see WFS parsing)
        var parser = new ol.format.WMSCapabilities();
        
        // The input URL is supposed to be in it's canonical form, i.e. it should be a valid 
        // GetCapabilities WMS request.
        $.ajax({
                type: "GET",
                url: url,
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

                    var response = xmlToJson(response);
                    //console.log('xmlToJson parsed response');
                    //console.log(response2);

                    //var response = parser.read(response);
                    //console.log('ol parsed response');
                    console.log(response);
                    //var version = response["version"];
                    if (response["ServiceExceptionReport"]){
                        alert("Service Exception Report. Please try again.");
                        return false;
                    }
                    var base = null;
                    if (response["WMS_Capabilities"]){
                        base = response["WMS_Capabilities"];
                    }
                    else if (response["WMT_MS_Capabilities"]){
                        base = response["WMT_MS_Capabilities"];
                        if (base instanceof Array){
                            $_.each(base, function(node, idx) {
                                if (node["Capability"]){
                                    base = node;
                                    return false;
                                }
                            });
                            }
                    }
                    if (!base["@attributes"]){
                        alert("WMS Capabilities Load Exception. Please try again.");
                        return false;
                    }
                    var version = base["@attributes"]["version"];
                    
                    var candidates = [];

                    //No layers so quit
                    if (! base["Capability"]["Layer"]){
                        alert("No WMS Layers found in provided endpoint.");
                        return false;
                    }
                    if (base["Capability"]["Layer"]["Layer"]){
                        candidates = base["Capability"]["Layer"]["Layer"];
                        }
                    else if (base["Capability"]["Layer"]) {
                        console.log('layer is');
                        console.log(base["Capability"]["Layer"]);
                        candidates = base["Capability"]["Layer"];
                    }
                    if (!(candidates instanceof Array)){
                        candidates = [candidates];
                    }
                    var zoomin=false;

                    //if (resource.url.startsWith(RASDAMAN_URL)){
                    if (resource.url.contains(RASDAMAN_URL)){
                        zoomin = true;
                    }

                    console.log('wmsserver');
                    console.log(resource.wms_server);
                    if (resource.wms_server){
                    //if (resource.url.startsWith(GEOSERVER_URL) || resource.url.startsWith(RASDAMAN_URL)){
                        console.log('PublicaMundi GEOSERVER/Rasdaman server');
                            var found = false;
                            $_.each(candidates, function(candidate, idx) {
                                if (candidate["Name"]["#text"] == resource.wms_layer){
                                    candidates = [candidate];
                                    found = true;
                                    return false;
                                }
                            });
                            if (found == false){
                                console.log('oops..layer not found, something wrong here...');
                            }
                        };

                    callback(candidates, version, zoomin);
                },

                failure: function(response) {
                    console.log('failed');
                    console.log(response);
                }


        });
    }

    var withWMSLayers = function (resource, layerProcessor) {
        
        var parsed_url = resource.url.split('#')
        var url_body = parsed_url[0].split('?')[0] // remove query if any
        var url = resource.proxy_service_url || parsed_url[0]

        var layerName = parsed_url.length > 1 && parsed_url[1]
      
        parseWMSCapas(
            resource,
            url,
            function(candidates, version, zoomin) {
                var count_candidates = candidates.length;

                    // Parse each WMS layer found
                    $_.each(candidates, function(candidate, idx) {
                        console.log('candidate');
                        console.log(candidate);       
                        
                        var name = null;
                        if (candidate["Name"]){
                            name = candidate["Name"]["#text"];
                        }
                        else if (candidate["wms:Name"]){
                            name = candidate["wms:Name"]["#text"];
                        }
                        else{
                            alert("Layer has no name attribute. Cannot display");
                            return false;
                        }
                            
                        var title = resource.name;
                        if (candidate["Title"]){
                            title = candidate["Title"]["#text"];
                        }
                        else if (candidate["wms:Title"]){
                            title = candidate["wms:Title"]["#text"];
                        }                    

                        var bbox = null;
                        var bboxfloat = null;
                        var crs = null;
                        if (candidate["BoundingBox"]){
                            bbox = candidate["BoundingBox"];
                            ret_dict = extractBbox(bbox);
                            bboxfloat = ret_dict['bbox'];
                            crs = ret_dict['crs'];
                        }
                        else if (candidate["wms:BoundingBox"]){
                            bbox = candidate["wms:BoundingBox"];
                            ret_dict = extractBbox(bbox);
                            bboxfloat = ret_dict['bbox'];
                            crs = ret_dict['crs'];
                        }
                        
                        var visibility = false;
                        
                        // If only 1 layer available then make it visible on load
                        if (count_candidates == 1){
                            visibility = true;
                        }
                    
                        // If there is a layer that matches part of the resource title then make it visible on load
                        else if (resource.name.startsWith(title)){
                            visibility = true;
                        }
                       
                        var mapLayer = {
                            type: PublicaMundi.LayerType.WMS,
                            url: url_body, // use the original URL for the getMap, as there's no need for a proxy for image request
                            name: name,
                            title: title,
                            bbox: bboxfloat,
                            bbox_crs: crs,
                            zoomin: zoomin,
                            visible: visibility,
                            params: {'LAYERS': name,
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
        if (! obj){
            return false;
        }
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

    String.prototype.contains = function(str){
        return this.indexOf(str) > -1;
    }
    var extractBbox = function (bbox) {
        var bboxtemp= null;
        var crs = null;
        var dict = {};
        
        $.each(bbox, function(idx, at) {
            if (at["@attributes"]){
                at = at['@attributes'];
            }
            if(at.CRS == "EPSG:4326") {
                bboxtemp = [ parseFloat(at.miny), parseFloat(at.minx), parseFloat(at.maxy) , parseFloat(at.maxx) ];
                crs = "EPSG:4326";
            }
            else if(at.CRS == "CRS:84") {
                bboxtemp = [ parseFloat(at.minx), parseFloat(at.miny), parseFloat(at.maxx), parseFloat(at.maxy) ];
                crs = "EPSG:4326";
                }
            else if(at.CRS == "EPSG:3857") {
                bboxtemp = [ parseFloat(at.minx), parseFloat(at.miny), parseFloat(at.maxx), parseFloat(at.maxy) ];
                crs = "EPSG:3857";
                }
            dict['bbox'] = bboxtemp;
            dict['crs'] = crs;

        
        });
        return dict;
    };
    

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
            var projection = "EPSG:3857";
            if (preload_resource.url.startsWith(KTIMA_URL)){
                projection = "EPSG:900913";
            }
            var baseLayers = [{
                        title: 'Open Street Maps',
                        type: PublicaMundi.LayerType.TILE,
                        url: 'http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
            }];

            var options = {
                target: 'map-ol',
                center: [-985774, 4016449],
                zoom: 1.6,
                projection: projection,
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
