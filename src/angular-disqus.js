const angular = require(`angular`);
const { isDefined, isFunction } = angular;

const moduleName = `angular-disqus`;
const disqusModule = angular.module(moduleName, []);

/**
 * $disqus provider.
 */
disqusModule.provider(`$disqus`, function(){
	const TYPE_EMBED = `embed.js`; // general disqus embed script
	const TYPE_COUNT = `count.js`; // used for count

	// Placeholder for the disqus shortname
	let shortname;

	/**
	 * @return {Element} dom element for script adding
	 */
	function getScriptContainer(){
		return document.getElementsByTagName(`head`)[0] || document.getElementsByTagName(`body`)[0];
	}

	/**
	 * @return {String} disqus shortname
	 */
	function getShortname(){
		return shortname || window.disqus_shortname;
	}

	/**
	 * @return {String} disqus shortname
	 */
	function getSso(){
		return window.disqus_sso || {};
	}

	/**
	 * @param {String} shortname disqus shortname
	 * @param {String} file file name to add.
	 * @return {String} disqus embed src with embedded shortname
	 */
	function getScriptSrc(shortname, file){
		return `//` + shortname + `.disqus.com/` + file;
	}

	/**
	 * Builds the script tag
	 *
	 * @param {String} src script source
	 * @return {Element} script element
	 */
	function buildScriptTag(src){
		const script = document.createElement(`script`);

		// Configure the script tag
		script.type = `text/javascript`;
		script.async = true;
		script.src = src;

		return script;
	}

	/**
	 * Searches the given element for defined script tag
	 * if its already there then return true. Otherwise return false
	 *
	 * @param {Element} element element to search within
	 * @param {String} scriptSrc script src
	 * @return {Boolean} true if its there, false if its not
	 */
	function hasScriptTagInPlace(container, scriptSrc){
		const scripts = container.getElementsByTagName(`script`);
		let script;
		let i;

		for(i = 0; i < scripts.length; i += 1){
			script = scripts[i];

			// Check if the name contains the given values
			// We need to check with indexOf because browsers replace // with their protocol
			if(~script.src.indexOf(scriptSrc)){
				return true;
			}
		}

		return false;
	}

	/**
	 * Writes disqus globals to window object.
	 * Needed for the first load. Otherwise the disqus wouldn't know what thread comments to load.
	 *
	 * @param {String} $location location service
	 * @param {String} id disqus identifier
	 * @param {String} title disqus title
	 */
	function setGlobals($location, id, title){
		window.disqus_identifier = id;
		window.disqus_url = $location.absUrl();
		window.disqus_shortname = shortname;
		window.disqus_title = title;

		const sso = getSso();
		if(Object.keys(sso).length > 0){
			window.disqus_config = function(){
				this.page.remote_auth_s3 = sso.remote_auth_s3;
				this.page.api_key = sso.api_key;
			};
		}
	}

	/**
	 * Refreshes the count from DISQUSWIDGETS.
	 */
	function getCount(){
		const widgets = window.DISQUSWIDGETS;
		if(widgets && isFunction(widgets.getCount)){
			widgets.getCount();
		}
	}

	/**
	 * Trigger the reset comment call
	 * @param  {String} $location location service
	 * @param  {String} id Thread id
	 * @param  {String} title Title page
	 */
	function resetCommit($location, id, title){
		const sso = getSso();

		window.DISQUS.reset({
			reload: true,
			config(){
				this.page.identifier = id;
				this.page.url = $location.absUrl();
				this.page.title = title;
				this.page.remote_auth_s3 = sso.remote_auth_s3;
				this.page.api_key = sso.api_key;
			}
		});
	}

	/**
	 * Adds disqus script tag to header by its type.
	 * If the script tag already exists in header then wont continue.
	 *
	 * Adds script tags by their type.
	 * Currently we are using two types:
	 *  1. count.js
	 *  2. embed.js
	 *
	 * @param {String} shortname disqus shortname
	 * @param {String} type disqus script tag type
	 */
	function addScriptTag(type){
		const shortname = getShortname();
		const container = getScriptContainer();
		const scriptSrc = getScriptSrc(shortname, type);

		// If it already has a script tag in place then lets not do anything
		// This might happen if the user changes the page faster than then disqus can load
		if(hasScriptTagInPlace(container, scriptSrc)){
			return;
		}

		// Build the script tag and append it to container
		container.appendChild(buildScriptTag(scriptSrc));
	}

	/**
	 * @param {String} sname shortname
	 */
	this.setShortname = function(sname){
		shortname = sname;
	};

	// Provider constructor
	this.$get = function($location){
		/**
		 * Resets the comment for thread.
		 * If disqus was not defined then it will add disqus to script tags.
		 * If disqus was initialized earlier then it will just use disqus api to reset it
		 *
		 * @param  {String} id required thread id
		 * @param  {String} title title page
		 */
		function commit(id, title){
			if(!isDefined(shortname)){
				throw new Error(`No disqus shortname defined`);
			}else if(!isDefined(id)){
				throw new Error(`No disqus thread id defined`);
			}else if(isDefined(window.DISQUS)){
				resetCommit($location, id, title);
			}else{
				setGlobals($location, id, title);
				addScriptTag(TYPE_EMBED);
			}
		}

		/**
		 * Single Sign On
		 *
		 * See more: https://help.disqus.com/customer/portal/articles/236206-single-sign-on
		 *
		 * @param dataSso Object with os params remote_auth_s3 and api_key
		 */
		function setSso(dataSso){
			window.disqus_sso = dataSso;
			if(isDefined(window.DISQUS)){
				resetCommit($location, window.disqus_identifier, window.disqus_title);
			}
		}

		/**
		 * Loads the comment script tag and initiates the comments.
		 * Sets the globals according to the current page.
		 *
		 * If the embed disqus is not added to page then adds that.
		 *
		 * @param {String} id thread id
		 */
		function loadCount(id){
			setGlobals($location, id);
			addScriptTag(TYPE_EMBED);
			addScriptTag(TYPE_COUNT);
			getCount();
		}

		// Expose public api
		return {
			commit,
			getShortname,
			setSso,
			loadCount
		};
	};
	this.$get.$inject = [`$location`];
});

const disqusService = $disqus => ({
	setSso(dataSso){
		$disqus.setSso(dataSso);
	}
});
disqusService.$inject = [`$disqus`];
disqusModule.service(`disqusService`, disqusService);

/**
 * Disqus thread comment directive.
 * Used to display the comments block for a thread.
 */
const disqusDirective = $disqus => ({
	restrict: `AC`,
	replace: true,
	scope: {
		id: `=disqus`,
		title: `=title`
	},
	template: `<div id="disqus_thread"></div>`,
	link(scope){
		scope.$watch(`id`, function(id){
			if(isDefined(id)){
				$disqus.commit(id, scope.title);
			}
		});
	}
});
disqusDirective.$inject = [`$disqus`];
disqusModule.directive(`disqus`, disqusDirective);

/**
 * Disqus comment count directive.
 * Just wraps `disqus-identifier` to load the disqus comments count script tag on page
 */
const disqusIdentifier = $disqus => ({
	restrict: `A`,
	link(_, _e, attr){
		$disqus.loadCount(attr.disqusIdentifier);
	}
});
disqusIdentifier.$inject = [`$disqus`];
disqusModule.directive(`disqusIdentifier`, disqusIdentifier);

module.exports = moduleName;