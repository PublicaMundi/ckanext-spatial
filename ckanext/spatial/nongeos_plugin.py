import mimetypes, urlparse, os
from logging import getLogger

import pylons.config as config

from ckan import plugins as p
import ckan.lib.helpers as h
from ckan.common import request
from ckan.lib.datapreview import compare_domains

log = getLogger(__name__)


def get_proxified_service_url(data_dict):
    '''
    :param data_dict: contains a resource and package dict
    :type data_dict: dictionary
    '''
    url = h.url_for(
        action='proxy_service',
        controller='ckanext.spatial.controllers.service_proxy:ServiceProxyController',
        id=data_dict['package']['name'],
        resource_id=data_dict['resource']['id']
        )
    log.info('Proxified url is {0}'.format(url))
    return url

class SpatialPublicaMundiPreview(p.SingletonPlugin):
    p.implements(p.IConfigurer, inherit=True)
    p.implements(p.IResourcePreview, inherit=True)
    p.implements(p.IRoutes, inherit=True)
    p.implements(p.IPackageController, inherit=True)

    #FORMATS = ['kml','geojson','gml','wms','wfs','shp', 'esrigeojson', 'gft', 'arcgis_rest']
    FORMATS = ['kml','geojson','wms','wfs']

    def update_config(self, config):
        p.toolkit.add_public_directory(config, 'public')
        p.toolkit.add_template_directory(config, 'templates')
        p.toolkit.add_resource('public', 'ckanext-spatial')

        self.proxy_enabled = p.toolkit.asbool(config.get('ckan.resource_proxy_enabled', 'False'))

    def setup_template_variables(self, context, data_dict):
        import ckanext.resourceproxy.plugin as proxy

        p.toolkit.c.gapi_key = h.config.get('ckanext.spatial.gapi.key')

        proxy_enabled = p.plugin_loaded('resource_proxy')
        
        resource_url = data_dict['resource']['url']
        same_domain = compare_domains((config.get('ckan.site_url'), resource_url))

        if proxy_enabled and not same_domain:
            data_dict['resource']['proxy_url'] = proxy.get_proxified_resource_url(data_dict)
            data_dict['resource']['proxy_service_url'] = get_proxified_service_url(data_dict)
        else:
            data_dict['resource']['proxy_url'] = resource_url
        return data_dict

    def add_default_views(self, context, data_dict):
        #resources = p.toolkit.get_new_resources(context, data_dict)
        #for resource in resources:
        #    if resource.get('format') in FORMATS:
        #d_v = config.get('ckan.view.default_views',[])
        d_v = []
        for v in d_v:
            if data_dict['resource']['format'] in FORMATS and v.can_view(data_dict['resource']):
                view = {'title': 'Map',
                        'description': 'View created with PublicaMundi API',
                        'resource_id': resource['id'],
                        'view_type': 'map',
                        }
                p.toolkit.get_action('resource_view_create')(
                        {'defer_commit': True}, view)

    def info(self):
        return {'name': 'publicamundi_spatial',
                'title': 'PublicaMundi Spatial',
                'icon': 'globe',
                'default_title': 'PublicaMundi Spatial',
                }

    #def can_view(self, data_dict):
    def can_preview(self, data_dict):
        format_lower = data_dict['resource']['format'].lower()
        
        #guess from file extension
        if not format_lower:
            #mimetype = mimetypes.guess_type(data_dict['resource']['url'])
            parsedUrl = urlparse.urlparse(data_dict['resource']['url'])
            format_lower = os.path.splitext(parsedUrl.path)[1][1:].encode('ascii','ignore').lower()
        correct_format = format_lower in self.FORMATS
        #proxy_enabled = p.plugin_loaded('resource_proxy')
        #same_domain = datapreview.on_same_domain(data_dict)

        #can_preview_from_domain = proxy_enabled or same_domain
        can_preview_from_domain = self.proxy_enabled or data_dict['resource']['on_same_domain']
        quality = 2

        if p.toolkit.check_ckan_version('2.1'):
            if correct_format:
                if can_preview_from_domain:
                    return {'can_preview': True, 'quality': quality}
                else:
                    return {'can_preview': False,
                            'fixable': 'Enable resource_proxy',
                            'quality': quality}
            else:
                return {'can_preview': False, 'quality': quality}
        return correct_format and can_preview_from_domain

    def preview_template(self, context, data_dict):
            return 'dataviewer/publica.html'

    def after_update(self, context, data_dict):
        #self.add_default_views(context, data_dict)
        pass

    def before_map(self, m):
        m.connect('/dataset/{id}/resource/{resource_id}/service_proxy/',
                  controller='ckanext.spatial.controllers.service_proxy:ServiceProxyController',
                  action='proxy_service')
        return m
