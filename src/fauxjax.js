(function($) {

    /* --------------------- Plugin Vars --------------------- */
    var _ajax          = $.ajax,
        fauxHandlers   = [],
        fakedAjaxCalls = [],
        realAjaxCalls  = [];

    /* -------------------- Public API ----------------------- */

    /**
     * Create new instance of faux request handler
     * @param {Object} settings The settings for the faux request
     * @returns {Int} Returns index faux request in handler array
     */
    $.fauxjax = function(settings) {
        fauxHandlers.push(settings);
        return fauxHandlers.length - 1;
    };

    /**
     * Default settings for fauxjax requests
     */
    $.fauxjax.settings = {
        status:        200,
        statusText:    "OK",
        responseTime:  500,
        isTimeout:     false,
        contentType:   'text/plain',
        response:      '',
        responseText:  '',
        headers:       {'content-type' : 'text/plain'}
    };

    /**
     * Clear all fauxjax arrays
     * @param {None}
     * @returns {undefined}
     */
    $.fauxjax.clear    = function() {
        fauxHandlers   = [];
        fakedAjaxCalls = [];
        realAjaxCalls  = [];
    };

    /**
     * Remove faux handler from handlers array
     * @param {Integer} index The index of the faux handler to be removed
     * @returns {undefined}
     */
    $.fauxjax.removeFaux = function(index) {
      fauxHandlers[index] = null;
    };

    /**
     * Gets an array containing all faux requests that have not been fired.
     * Useful is test teardown to check for unneeded mocking.
     * @param {None}
     * @returns {Array} Returns an array of faux requests that have not been fired
     */
    $.fauxjax.unfiredFauxHandlers = function() {
        var results = [];
        for (var i=0, len=fauxHandlers.length; i<len; i++) {
            var handler = fauxHandlers[i];
            if (handler !== null && !handler.fired) {
                results.push(handler);
            }
        }
        return results;
    };

    /**
     * Gets an array containing all real ajax requests.
     * Useful is test teardown to check for requests that need to be mocked.
     * @param {None}
     * @returns {Array} Returns an array of real ajax requests that have been fired
     */
    $.fauxjax.realAjaxCalls = function() {
        return realAjaxCalls;
    };

    /* -------------------- Internal Plugin API ----------------------- */
    $.extend({
        ajax: interceptAjax
    });

    /**
     * Compares a mockHandler and a real Ajax request and determines if the real request should be mocked.
     * @param {Object} mockHandler A fauxjax settings object
     * @param {Object} realRequestContext The real context of the actual Ajax request
     * @returns {Boolean} Returns true if the real request should be mocked false otherwise
     */
    function shouldMockRequest(mockHandler, realRequestContext) {
        if (!mockHandler) {
            /** Handler was removed by id **/
            return false;
        }
        if (mockHandler.data && !realRequestContext.data || !_.isEqual(mockHandler.data, realRequestContext.data)) {
            return false;
        }
        if (!_.isEqual(mockHandler.url, realRequestContext.url)) {
            return false;
        }
        if (mockHandler.type && mockHandler.type.toLowerCase() != realRequestContext.type.toLowerCase()) {
            return false;
        }
        return true;
    }

    /**
     * Properly format the faux request's responseText to be sent in the faux xhr
     * @param {Object|String} responseText The value of `responseText` in the mock request
     * @returns {String} Returns a string version of the `responseText`
     */
    function formatResponseText(responseText) {
        if (_.isObject(responseText)) {
            return JSON.stringify(responseText);
        }
        return responseText;
    }

    /**
     * The send operation of the faux xhr object
     * @param {Object} mockRequestContext The context of the faux request
     * @param {Object} realRequestContext The context of the real Ajax request
     * @returns {undefined}
     */
    function _xhrSend(mockRequestContext, realRequestContext) {
        var process = _.bind(function() {
                                  var onReady;
                                  this.status = mockRequestContext.isTimeout ? -1 : mockRequestContext.status;
                                  this.statusText = mockRequestContext.statusText;
                                  this.responseText = formatResponseText(mockRequestContext.responseText);
                                  onReady = this.onreadystatechange || this.onload;// jQuery 2.0 renamed onreadystatechange to onload
                                  onReady.call(this);
                             }, this);
        realRequestContext.async ? setTimeout(process, mockRequestContext.responseTime) : process();
    }

    /**
     * Build a faux xhr object that can be used in the faux ajax response
     * @param {Object} mockHandler
     * @param {Object} realRequestContext
     * @returns {Object} Returns a faux xhr object
     */
    function xhr(mockHandler, realRequestContext) {
        mockRequestContext = _.assign({}, $.fauxjax.settings, mockHandler);
        mockRequestContext.headers['content-type'] = mockRequestContext.contentType;
        realRequestContext.headers = {};
        return {
            status: mockRequestContext.status,
            statusText: mockRequestContext.statusText,
            open: function() { },
            send: function() {
                mockHandler.fired = true;
                _xhrSend.call(this, mockRequestContext, realRequestContext);
            },
            setRequestHeader: function(header, value) {
                realRequestContext.headers[header] = value;
            },
            getAllResponseHeaders: function() {
                var headers = '';
                $.each(mockRequestContext.headers, function(k, v) {
                    headers += k + ': ' + v + "\n";
                });
                return headers;
            }
        };
    }

    /**
     * The actual call to the jQuery ajax method
     * @param {Object} mockHandler
     * @param {Object} realRequestContext
     * @param {Object} realRequestSettings
     * @returns {undefined}
     */
    function makeFauxAjaxCall(mockHandler, realRequestContext, realRequestSettings) {
        _ajax.call($, _.assign({}, realRequestSettings, {
          xhr: function() {return xhr(mockHandler, realRequestContext);}
        }));
    }

    /**
     * The entry point of the plugin. This intercepts calls to jQuery's ajax method
     * @param {Object} realRequestSettings The real request settings from the actual ajax call
     */
    function interceptAjax(realRequestSettings) {
        var realRequestContext = _.assign({}, $.ajaxSettings, realRequestSettings);
        for(var k = 0; k < fauxHandlers.length; k++) {
            if (shouldMockRequest(fauxHandlers[k], realRequestContext)) {
              fakedAjaxCalls.push(realRequestContext);
              makeFauxAjaxCall(fauxHandlers[k], realRequestContext, realRequestSettings);
              return;
            }
        }
        realAjaxCalls.push(realRequestSettings);
        return _ajax.apply($, [realRequestSettings]);
    }

})(jQuery);