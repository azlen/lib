var placeHolderValueLookup = []

//Returns true if it is a DOM node
function isNode(o){
  return (
    typeof Node === "object" ? o instanceof Node : 
    o && typeof o === "object" && typeof o.nodeType === "number" && typeof o.nodeName==="string"
  );
}

//Returns true if it is a DOM element    
function isElement(o){
  return (
    typeof HTMLElement === "object" ? o instanceof HTMLElement : //DOM2
    o && typeof o === "object" && o !== null && o.nodeType === 1 && typeof o.nodeName==="string"
);
}

function r(a,b,c){
	b = b || {}
	c = c || []
	if ( b.constructor != Object || b.isReactiveTemplate == true ) {
		c = b
		b = {}
	}
	if ( c.constructor != Array ) {
		c = [c]
	}
	return {
		tag: a,
		properties: b,
		children: c,
		isReactiveTemplate:true,
		isSVG:false
	}
}
function svg(a,b,c){
	var s = r(a,b,c)
	s.isSVG = true
	return s
}

function el(o){
	var element;
	if(o && o.isReactiveTemplate){
		if(o.isSVG){
			element = document.createElementNS('http://www.w3.org/2000/svg', o.tag)
		}else{
			element = document.createElement(o.tag)
		}
		var listeners = []
		for(var i in o.properties){
			 createProp(element, i, o.properties[i])
		}
		element.appendChild( createChildren(o.children) )
	}else{
		element = document.createTextNode(o)
	}
	return element
}

function createProp(element, key, prop){
	if(typeof prop == 'function' && prop.parent != undefined){
		var data = prop()
		element.setAttribute(key, data.object[data.property])
		listen(data.object, data.property, function(change){
			if(change.type == 'update' || change.type == 'add'){
				element.setAttribute(key, change.object[change.name])
			}else if(change.type == 'delete'){
				element.setAttribute(key, '')
			}
		})
		return data
	}
	if( typeof element[key] != "undefined" && element[key] == null && key.match(/^on.*/) != null && typeof prop == 'function' ){ // MAKE THIS SHORTER PLEASE!!!!
		element.addEventListener( key.match(/^on(.*)/)[1], prop )
	}else if( key == 'style' && typeof prop == 'object' ){
		createStyle( element, prop )
	}else{
		element.setAttribute(key, prop)
	}
	return undefined // WHY? THIS IS COMPLETELY POINTLESS!!!!!!
}

function createStyle(element, style){
	for(var i in style){
		createStyleProp(element, style, i)
	}
}

function createStyleProp(element, style, i){
	if(typeof style[i] == 'function' && style[i].parent != undefined){
		var data = style[i]()
		element.style[i] = data.object[data.property]
		listen(data.object, data.property, function(change){
			if(change.type == 'update' || change.type == 'add'){
				element.style[i] = change.object[change.name]
			}else if(change.type == 'delete'){
				element.style[i] = ''
			}
		})
	}
	element.style[i] = style[i]
}


function createChild( data ){
	if( typeof data == "function" ){
		if( data.parent == obs || data.parent == plh ){
			return createChildObs( data() )
		}else if( data.parent == map){
			return createChildMap( data() )
		}
	}else if( data && data.constructor == Array ){
		return createChildren( data )
	}else{
		return el( data )
	}
}

function createChildObs( data ){
	var child = el( data.object[data.property] );
	listen(data.object, data.property, function(change){
		if(change.type == 'update' || change.type == 'add'){
			if( change.object[change.name].isReactiveTemplate || isElement(child) ){
				var newchild = el(change.object[change.name])
				child.parentNode.replaceChild( newchild, child )
				child = newchild
			}
			if( isNode(child) ){
				child.nodeValue = change.object[change.name]
			}
		}else if(change.type == 'delete'){
			if( isElement(child) ){
				var newchild = el('')
				child.parentNode.replaceChild( newchild, child )
				child = newchild
			}else{
				child.nodeValue = ''
			}
		}
	})
	return child
}

function createChildMap( data ){
	var index = placeHolderValueLookup.length

	var placeHolderValueLookupBackup = []
	for( var i in placeHolderValueLookup ){
		placeHolderValueLookupBackup.push( placeHolderValueLookup[i] )
	}

	var f = typeof data.fn == 'function' && data.fn.parent == undefined
	var array =  f ? data.array.map( data.fn ) : data.array.map(function(){return data.fn})
	var c = createChildMapChildren( array, data.array )

	var fragment = c.fragment
	array = c.array
	
	Object.observe(data.array, function(changes){
		changes.forEach(function(change){
			if(change.name != 'length'){
				if( change.type == 'update' ){ // FIX THIS PLEASE (there should probably be some actual code within these curly brackets (for when someone gives a function (who would do that!?) to the MAP function (ohmygosh does that mean I have to do some tiny diffing?... noooooo)))
					/*var element = createChild( f ? data.fn( change.object[change.name] ) : data.fn )
					getLastChild( array[0] ).parentNode.replaceChild( element, array[change.name] )
					array.splice(change.name, 1, element)*/
				}else if( change.type == 'add' ){
					placeHolderValueLookup = placeHolderValueLookupBackup

					var childdata = f ? data.fn( change.object[change.name] ) : data.fn
					var element;
					var elementdata;
					if(childdata.constructor == Array){
						var c2 = createChildMapChildren( childdata, change.object, change.name )
						element = c2.fragment
						elementdata = c2.array
					}else{
						placeHolderValueLookup[index] = [ change.object, change.name ]
						elementdata = element = createChild( childdata )
					}

					var l = getLastChild( array[Number(change.name)-1] )
					if( l == getLastChild( l.parentNode.children ) || l == getLastChild( l.parentNode.childNodes ) ){
						l.parentNode.appendChild( element )
					}else{
						l.parentNode.insertBefore( element ,l.nextSibling )
					}
					
					array.push(elementdata)

					placeHolderValueLookup.pop()
					placeHolderValueLookup = []
				}else if( change.type == 'delete' ){
					var i = Number(change.name)
					var list = getAllChildren( array[i] )
					for(var i2 in list){
						list[i2].parentNode.removeChild(list[i2])
					}
					array.splice(i, 1)
				}
			}
		})
	})
	return fragment
}

function getAllChildren( data ){
	var array = []
	if( isElement(data) || isNode(data) ){
		array = [data]
	}else{
		for(var i in data){
			if(data[i].constructor == Array){
				array.concat( getAllChildren( data[i] ) )
			}else{
				array.push(data[i])
			}
		}
	}
	return array
}

function getLastChild( data ){
	if( isElement(data) || isNode(data) ){
		return data
	}else{
		return getLastChild( data[data.length-1] )
	}
}

function createChildMapChildren( data, values, superindex ){
	var fragment = document.createDocumentFragment()
	var index = placeHolderValueLookup.length

	var mapped = data.map(function(d, i){
		if( d.constructor == Array ){
			placeHolderValueLookup.pop()
			var c = createChildMapChildren( d, values, i )
			placeHolderValueLookup[index] = 0
			fragment.appendChild( c.fragment )
			return c.array
		}
		placeHolderValueLookup[index] = [values, superindex || i]
		return fragment.appendChild( createChild( d ) )
	})
	placeHolderValueLookup.pop()
	return {
		fragment: fragment,
		array: mapped
	}
}

function createChildren( data ){
	var child = document.createDocumentFragment()
	data.forEach(function(d){
		child.appendChild( createChild(d) )
	})
	return child
}



function render(o, e){
	e = e || document.body
	var list = []
	if ( o.constructor == Array ) {
		for ( i in o ) {
			list.push( o[i] )
		}
	} else {
		list.push( o )
	}
	e.appendChild( createChild(list) )
}

function obs(object, property){
	function get(){
		return {
			object:object,
			property:property
		}
	}
	get.parent = obs
	return get
}

function map(array, fn){
	function get(){
		return {
			array:array,
			fn:fn
		}
	}
	get.parent = map
	return get
}

function plh(nested){
	nested = nested || 0
	function get(){
		return obs( placeHolderValueLookup[nested][0], placeHolderValueLookup[nested][1] )()
	}
	get.parent = plh
	return get
} 

function listen(object, property, callback){
	Object.observe(object, function(changes){
		changes.forEach(function(change){
			if(change.name == property){
				callback(change)
			}
		})
	})
}
