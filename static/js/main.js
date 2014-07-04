/* style info */
jQuery('.dimmer').dimmer('hide');
var main = new Ractive({
        el: 'main',
        template: '#template',
        data: {links:[], filters:[], action:'get'},
        twoway: false
    });

jQuery.getJSON(BASE_URL).then(function(data){
        data.collection.links.sort(function(a,b){return (a.model.toLowerCase()<b.model.toLowerCase())?-1:+1;});
        main.set('links',data.collection.links);
        main.set('selected_links',data.collection.links);        
    });

var load = function(href) {
    if(!href) {
	var tablename = main.data.tablename;
	var query = filters2query(main.data.filters);
	href = BASE_URL+'/'+tablename+'?'+query;
        window.location.hash = href.split('/').splice(6).join('/');

    } else {
        window.location.hash = href.split('/').splice(6).join('/');
	main.set('tablename',href.split('/')[6].split('?')[0]);
	main.set('filters',hash2filters(window.location.hash))
    }
    jQuery('.dimmer').dimmer('show');
    jQuery('[disabled]').each(function(){
	    jQuery(this).attr('disabled',false).closest('.field').css('opacity',1.0);
	});
    jQuery.getJSON(href).then(function(data){
	    if(tablename) main.set('tablename',tablename);
	    if(href) main.set('href',href);
	    main.set('collection',data.collection);
	    jQuery('.checkbox').checkbox();
	    jQuery('.dimmer').dimmer('hide');
	    jQuery('.red.pointing.above').remove();
	    if(main.data.action=='put' && data.collection.items.length==1) { // dangerous
		for(var k=0; k<data.collection.items[0].data.length; k++) {
		    var field = data.collection.items[0].data[k];
		    if(field.type!='upload')
			jQuery('[name={1}]'.assign(field.name)).val(field.value);
		}
	    }
	});
};

main.on('load-model',function(event){
        event.original.preventDefault();
        load(event.node.getAttribute('href'));
	jQuery(window).scrollTop(0);
    });

main.on('model-search',function(event) {
        var search = jQuery(event.node).val();
        main.set('selected_links',main.data.links.filter(function(x){return x.model.indexOf(search)>-1;}));
    });

var form2json = function(form) {
    return new Promise(function(resolve,reject) {
	    var promises = [];
	    var data = {};
	    form.find('[name]:not([disabled])').each(function(){
		    var t=jQuery(this); 
		    var name = t.attr('name'), ttype=t.attr('type'), value;
		    if(ttype=='checkbox' || ttype=='radio') {
			value = t.is(':checked')?true:false;
		    } else if(ttype=='file') {
			if(t[0].files && t[0].files[0]) {
			    var file = t[0].files[0];
			    promises.push(new Promise(function(resolve,reject){
					var reader = new FileReader();
					var tmp = {filename:file.name, data:null};
					reader.onload = function(e) { 
					    tmp.data = e.target.result; resolve(); };
					reader.readAsBinaryString(file);
					value = tmp;
			    }));
			} else {
			    value = {};
			}
		    } else {
			value = t.val();
		    }
		    data[name] = value;
		});
	    Promise.all(promises).then(function(){
		    resolve(JSON.stringify({data:data}));
		});
	});
};

var filters2query = function(filters) {
    var items = filters.map(function(item){
            var v = item.value;
            v = v.replace(/\s+contains?\s+/i,'.contains=',1);
            v = v.replace(/\s+starts?(\s+with)\s+/i,'.startswith=',1);
            v = v.replace(/\s+(is\s+)?not(\s+equal)?(\s+to)?\s+/i,'.ne=',1);
            v = v.replace(/\s+(is\s+)?less(\s+or)?\s+equal(\s+then)?\s+/i,'.le=',1);
            v = v.replace(/\s+(is\s+)?greater(\s+or)?\s+equal(\s+then)?\s+/i,'ge=',1);
            v = v.replace(/\s+(is\s+)?less(\s+then)?\s+/i,'.lt=',1);
            v = v.replace(/\s+(is\s+)?greater(\s+then)?\s+/i,'.gt=',1);
            v = v.replace(/\s+is(\s+equal(\s+to)?)?\s+/i,'=',1);            
            v = v.replace(/\s*\<\s*/,'.lt=');
            v = v.replace(/\s*\>\s*/,'.gt=');
            v = v.replace(/\s*\<\=\s*/,'.le=');
            v = v.replace(/\s*\>\=\s*/,'.ge=');
            v = v.replace(/\s*\!\=\s*/,'.ne=');
	    if(v.indexOf('=')<0) v = v.replace(/\s+/,'=',1);
            return v.split('=').map(encodeURIComponent).join('=');
        });
    return items.join('&');
};

var hash2filters = function(hash) {    
    var parts = hash.split('?');
    var args = parts[0]
    var query = parts[1];
    var id = args.split('/')[1];
    if(id) query = ('id='+id)+((query)?('&'+query):'');
    if(!query) return [];
    return query.split('&').map(function(item){
            var parts = item.split('=').map(decodeURIComponent);
            parts[0] = parts[0].replace('.ne',' is not')
	    .replace('.eq',' is')
	    .replace('.le',' <=')
	    .replace('.ge',' >=')
	    .replace('.lt',' <')
	    .replace('.gt',' >')
	    .replace('.contains',' contains')
	    .replace('.startswith',' starts with')
            return {'value':parts.join(' ')};
        });
};

main.on('submit-form', function(event) {
        event.original.preventDefault();	
        form2json(jQuery(event.node).closest('form')).then(function(json) {
		jQuery('.red.pointing.above').remove();
		var href = main.data.href.split('?')[0];
		jQuery.ajax({
			method:'POST',
			    url:main.data.href,
			    data:json, 
			    contentType:'application/json',
			    success: function(data, textStatus, request){
			    var href = request.getResponseHeader('location');
			    if(href) load(href); else load();
			},
			    error: function(jqXHR, textStatus, request) {
			    var data = jQuery.parseJSON(jqXHR.responseText).collection; 
			    var red = '<div class="ui red pointing above ui label">{1}</div>';
			    if(data.errors) {
				for(var name in data.errors) {
				    var err = jQuery(red.assign(data.errors[name].message));
				    jQuery('[name={1}]'.assign(name)).after(err)
					.change(function(){err.remove()});
				}
			    }
			}
		    });		
	    });
    });

main.on('add-filter',function(event) {
	event.original.preventDefault();
	main.data.filters.push({value:event.node.value});
	event.node.value = '';
	main.set('filters',main.data.filters);
	load();
    });

main.on('delete-filter',function(event) {
        event.original.preventDefault();
        var index = parseInt(event.node.getAttribute('data-index'));
        main.data.filters.splice(index,1);
        main.set('filters',main.data.filters);
	load();
    });

main.on('remove-field',function(event) {
	event.original.preventDefault();
	var field = jQuery(event.node).closest('.field');
	var input = field.find('input,textarea');
	if(input.is('[disabled]')) { field.css('opacity',1.0); input.attr('disabled',false); }
	else { field.css('opacity',0.5); input.attr('disabled',true); }
    });

main.on('sort-by',function(event) {
	event.original.preventDefault();
	var name = event.node.getAttribute('data-name');
	main.data.filters.push({value:'_orderby '+name});
	main.set('filters',main.data.filters);
	load();
    });

main.on('set-get',function(event) {
	main.set('action','get'); 
	jQuery('.post-action').hide();
	jQuery('.get-action').slideDown();
});

main.on('set-put',function(event) {
	main.set('action','put');
	load();
	jQuery('.post-action').show();
	jQuery('.get-action').slideUp();
    });

main.on('set-post',function(event) {
	main.set('filters',[]); main.set('action','post');	
	jQuery('[name]').val('');
	jQuery('.post-action').show();
	jQuery('.get-action').slideUp();
    });

main.on('delete-selected',function(event) {
	if(confirm('Delete selected records. Sure?'))
	    jQuery.ajax({
		    method:'DELETE',
			url:main.data.href,
			success: function(data, textStatus, request){ load(); }
		});
    });

if(window.location.hash) {
    load(BASE_URL+'/'+window.location.hash.substr(1));
}

