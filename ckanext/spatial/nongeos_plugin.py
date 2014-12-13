import mimetypes, urlparse, os
from logging import getLogger

from ckan import plugins as p
import ckan.lib.helpers as h

from ckan.common import request

log = getLogger(__name__)


def get_proxified_service_url(data_dict):
    '''
    :param data_dict: contains a resource and package dict
    :type data_dict: dictionary
    '''
    print 'PROXIFYING'

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

        if self.proxy_enabled and not data_dict['resource']['on_same_domain']:
            p.toolkit.c.resource['proxy_url'] = proxy.get_proxified_resource_url(data_dict)
            p.toolkit.c.resource['proxy_service_url'] = get_proxified_service_url(data_dict)
        else:
            p.toolkit.c.resource['proxy_url'] = data_dict['resource']['url']

    def can_preview(self, data_dict):
        format_lower = data_dict['resource']['format'].lower()
        
        #guess from file extension
        if not format_lower:
            #mimetype = mimetypes.guess_type(data_dict['resource']['url'])
            parsedUrl = urlparse.urlparse(data_dict['resource']['url'])
            format_lower = os.path.splitext(parsedUrl.path)[1][1:].encode('ascii','ignore').lower()
        correct_format = format_lower in self.FORMATS
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

    def before_map(self, m):
        m.connect('/dataset/{id}/resource/{resource_id}/service_proxy/',
                  controller='ckanext.spatial.controllers.service_proxy:ServiceProxyController',
                  action='proxy_service')
        return m
