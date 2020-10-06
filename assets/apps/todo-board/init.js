var mainWindow;
var origin;
var isWritable;
window.addEventListener('message', function (e) {
    // You must verify that the origin of the message's sender matches your
    // expectations. In this case, we're only planning on accepting messages
    // from our own origin, so we can simply compare the message event's
    // origin to the location of this document. If we get a message from an
    // unexpected host, ignore the message entirely.
    if (e.origin !== (window.location.protocol + "//" + window.location.host))
        return;
    
    mainWindow = e.source;
    origin = e.origin;

    if (e.data.type == "save") {
	    var text = save();
	    mainWindow.postMessage({action:'save', text:text}, e.origin);
    } else if (e.data.type == "respondRenameList") {
        respondToRename(e.data.index, e.data.newName);
    } else {
        isWritable = e.data.isWritable;
        load(e.data.title, e.data.text);
    }
});

//mobile drag and drop from https://github.com/timruffles/mobile-drag-drop
var addEvent = (function () {
  if (document.addEventListener) {
    return function (el, type, fn) {
      if (el && el.nodeName || el === window) {
        el.addEventListener(type, fn, false);
      } else if (el && el.length) {
        for (var i = 0; i < el.length; i++) {
          addEvent(el[i], type, fn);
        }
      }
    };
  } else {
    return function (el, type, fn) {
      if (el && el.nodeName || el === window) {
        el.attachEvent('on' + type, function () { return fn.call(el, window.event); });
      } else if (el && el.length) {
        for (var i = 0; i < el.length; i++) {
          addEvent(el[i], type, fn);
        }
      }
    };
  }
})();

var nextListId = 0;
let todoListColours= ['#9e5fff','#00a9ff','#ff5583','#03bd9e','#bbdc00','#ffbb3b'];

var changeMade = false;

function getNextListId() {
	nextListId = nextListId + 1;
	return nextListId;
}
function buildNextList(index) {
	var parent = document.getElementById("board");
	var container = document.createElement("div");
	container.id='nextList';
	var buttonImg = document.createElement("img");
    buttonImg.src = "./images/plus.png";
	buttonImg.addEventListener('click', function(){buildNewList(index, 'New List', true);});
    container.appendChild(buttonImg);
    parent.appendChild(container);
}

function renameList(index) {
	var listName = document.getElementById("todoListName" + index);
	let currentName = listName.childNodes[0].nodeValue;
    mainWindow.postMessage({action:'requestRenameList', index: index, currentName: currentName}, origin);
}

function respondToRename(index, newName) {
	var listName = document.getElementById("todoListName" + index);
    listName.innerText = newName;
	listName.appendChild(document.createTextNode('\u00A0\u00A0'));
    var editButtonImg = document.createElement("img");
    editButtonImg.src = "./images/edit.png";
    editButtonImg.addEventListener('click', function(){renameList(index);});
    listName.appendChild(editButtonImg);
    registerChange();
}

function removeList(index) {
	var parent = document.getElementById("board");
	var listId = "todoListContainer" + index;
	var listToRemove = document.getElementById(listId);
	parent.removeChild(listToRemove);
	registerChange();
}

function buildNewList(index, name, buildNext) {
	var parent = document.getElementById("board");
	var nextList = document.getElementById("nextList");
	if (nextList != null) {
		parent.removeChild(nextList);
	}

	var listContainerId = "todoListContainer" + index;
	var listNameId = "todoListName" + index;
	var listId = "todoList" + index;
	var itemId = "todoItem" + index;
	var list = document.createElement("div");
	list.classList.add("list");
	list.id = listContainerId;

	var listInner = document.createElement("div");
	listInner.classList.add("list-inner");


	var listAccent = document.createElement("div");
	listAccent.classList.add("list-accent");
	listAccent.id = "todoListAccent" + index;
	let colour = todoListColours[index % todoListColours.length];
	listAccent.style.backgroundColor = colour;
	listInner.appendChild(listAccent);

	var heading = document.createElement("div");
	var closeButtonImg = document.createElement("img");
    closeButtonImg.src = "./images/trash.png";
	closeButtonImg.addEventListener('click', function(){removeList(index);});
    heading.appendChild(closeButtonImg);
	var span = document.createElement("span");

	var listName = document.createElement("h3");
	listName.classList.add("list-name");
	listName.id = listNameId;
    listName.innerText = name;

    listName.appendChild(document.createTextNode('\u00A0\u00A0'));
    var editButtonImg = document.createElement("img");
    editButtonImg.src = "./images/edit.png";
	editButtonImg.addEventListener('click', function(){renameList(index);});
    listName.appendChild(editButtonImg);


    span.appendChild(listName);
    heading.appendChild(span);
    listInner.appendChild(heading);
	var orderedList = document.createElement("ol");
	orderedList.id = listId;
    listInner.appendChild(orderedList);
	var formDiv = document.createElement("div");
	formDiv.classList.add("new-entry");
	var form = document.createElement("form");
	form.addEventListener('submit', function(e){return onFormSubmit(e, itemId, listId);});
	var inputItem = document.createElement("input");
	inputItem.classList.add("new-input");
	inputItem.type="text";
	inputItem.id = itemId;
	//inputItem.size = 60;
	inputItem.maxlength = 60;
	inputItem.placeholder = "Type something";

    form.appendChild(inputItem);
    formDiv.appendChild(form);
    listInner.appendChild(formDiv);
    addDragAndDropListeners(list);
    list.appendChild(listInner);
    parent.appendChild(list);

    document.getElementById(listId).addEventListener('click', function(ev) {
  		if (ev.target.tagName === 'LI' &&  !ev.target.classList.contains('empty-item')) {
			ev.target.classList.toggle('checked');
  		}
	}, false);

	addEmptyTodoItem(listId);
	inputItem.focus();

    if(buildNext) {
	    buildNextList(getNextListId());
	}
}

function onFormSubmit(e, todoItem, todoList) {
  e.preventDefault();

  var inputValue = document.getElementById(todoItem).value.trim();
  if (inputValue === '') {
    return;
  }
  let newItem = {id: uuidv4(), created: new Date().getTime(), text:inputValue, checked: false};
  appendTodoItem(newItem, todoList);
  document.getElementById(todoItem).value = "";
  registerChange();
  return false;
}

function registerChange() {
  if (isWritable && ! this.changeMade) {
    this.changeMade = true;
    mainWindow.postMessage({action:'registerChange'}, origin);
  }
}

function appendTodoItem(item, todoList) {

 let todoListElement = document.getElementById(todoList);
  var listElements = todoListElement.childNodes;
  for(var i=0; i < listElements.length; i++) {
  		if(listElements[i].classList.contains("empty-item")){
  			todoListElement.removeChild(listElements[i]);
  			break;
  		}
  }
  var li = document.createElement("li");
  var t = document.createTextNode(item.text);
  li.appendChild(t);
  addDragAndDropListeners(li);

  li.setAttribute("id", item.id);
  li.setAttribute("created", item.created);
  if(item.checked) {
  	li.classList.toggle('checked');
  }
  todoListElement.appendChild(li);

  var span = document.createElement("SPAN");
  var txt = document.createTextNode("\u00D7");
  span.className = "close";
  span.appendChild(txt);
  span.addEventListener('click', close);
  li.appendChild(span);
}

function addEmptyTodoItem(todoList) {

  var li = document.createElement("li");
  li.classList.add("empty-item");
  var t = document.createTextNode("");
  li.appendChild(t);
  addDragAndDropListeners(li);
  li.setAttribute("draggable", "false");
  document.getElementById(todoList).appendChild(li);
}

 function close(evt){
    var parent = evt.currentTarget.parentElement;
    let todoList = parent.parentElement;
    parent.remove();
    if(todoList.childElementCount ==0) {
    	addEmptyTodoItem(todoList.id);
    }
    registerChange();
  }

function addDragAndDropListeners(element) {
  element.addEventListener('dragstart', dragStarted);
  element.addEventListener('drop', dropped);
  element.setAttribute("draggable", "true");

  addEvent(element, 'dragenter', function (e) {
    e.preventDefault();
    e.stopPropagation();
  });

  addEvent(element, 'dragover', function (e) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
  });

  addEvent(element, 'dragexit', function (e) {
    e.stopPropagation();
  });

  addEvent(element, 'dragleave', function (e) {
    e.stopPropagation();
  });
}


function dragStarted(evt){
	evt.dataTransfer.setData("Text", evt.target.id);
	evt.dataTransfer.effectAllowed = "move";
}

function dropped(evt){
	let source = document.getElementById(evt.dataTransfer.getData('Text'));
  	let sourceTodoList = source.parentElement;
  	if(sourceTodoList.id == "board") {
  		droppedList(evt);
  		return;
  	}
	evt.preventDefault();
	evt.stopPropagation();
	let list = document.getElementById(evt.currentTarget.parentElement.id);
	var target = evt.target;
	if(target.classList.contains("new-entry") || target.localName == "div" || target.localName == "img") {
		return;
	}
	if(target.type == "submit" || target.id.includes("todoListName") || target.id.includes("todoItem") || target.id.includes("todoListContainer")) {
		return;
	}

	var res = source.compareDocumentPosition(target);
	//2: The first node (p1) is positioned after the second node (p2).
	if (res != 2) {
		target = target.nextElementSibling;
	} else if(sourceTodoList.id != target.parentElement.id) {
		target = target.nextElementSibling;
	}
	try {
  		list.insertBefore(source, target);
  		//get rid of empty if required
  		if(evt.currentTarget.classList.contains("empty-item")) {
  			evt.currentTarget.parentElement.removeChild(evt.currentTarget);
  		}
  		//add empty to source if required
    	if(sourceTodoList.childElementCount ==0) {
    		addEmptyTodoItem(sourceTodoList.id);
    	}
    	registerChange();
    } catch (ex) {
    	//likely trying to drop onto something unexpected
    }
}

function droppedList(evt){
	let source = document.getElementById(evt.dataTransfer.getData('Text'));
	evt.preventDefault();
	evt.stopPropagation();
	if (!source.id.includes("todoListContainer")) {
		return;
    }
	var target = evt.currentTarget;
	while(!target.id.includes("todoListContainer")) {
		target = target.parentElement;
	}
	var res = source.compareDocumentPosition(target);
	//2: The first node (p1) is positioned after the second node (p2).
	if(res != 2) {
		target = target.nextElementSibling;
	}
	let board = document.getElementById('board');
  	board.insertBefore(source, target);
    registerChange();
}
// tmp fix for iOS10 touchmove bug (https://github.com/timruffles/ios-html5-drag-drop-shim/issues/77)
window.addEventListener('touchmove', function () {})

function load(title, lists) {
    let polyfillApplied = MobileDragDrop.polyfill();
    if (polyfillApplied) {
		console.log("mobile DnD polyfill applied");
    }
    var largestIndexNumber = 0;
    if(lists.length == 0) {
        buildNewList(getNextListId(), title, true);
        document.getElementById("todoBoardTitle").innerHTML = title;
        return;
    }
    lists.forEach(function(list, listIdx){
        let index = new Number(list.id);
        if(index > largestIndexNumber) {
            largestIndexNumber = index;
        }
        let name = list.name;
        buildNewList(index, name, false);

        list.items.forEach(function(item){
	        appendTodoItem(item, "todoList" + index);
        });
        if(listIdx == lists.length - 1) {
            nextListId = largestIndexNumber;
            buildNextList(getNextListId());
            document.getElementById("todoBoardTitle").innerHTML = title;
        }
    });

}
//https://stackoverflow.com/questions/105034/how-to-create-guid-uuid
function uuidv4() {
  return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  );
}
function safetext(text){
	var table = {
		'<': 'lt',
		'>': 'gt',
		'"': 'quot',
		'\'': 'apos',
		'&': 'amp',
		'\r': '#10',
		'\n': '#13'
	};

	return text.toString().replace(/[<>"'\r\n&]/g, function(chr){
		return '&' + table[chr] + ';';
	});
	return text;
};
function save() {
	let contents = [];
	let boards = document.getElementById("board");
	let lists = boards.childNodes;
    for(var j=0; j < lists.length; j++) {
		let list = lists[j];
		if(list.id != null && list.id.includes("todoListContainer")) {
			let index = list.id.substring("todoListContainer".length);
			let listNameNode = document.getElementById("todoListName" + index);
			let todoListName = listNameNode.childNodes[0].nodeValue;

			let todoItems = [];

			let listItems = document.getElementById("todoList" + index).childNodes;
		    for(var i=0; i < listItems.length; i++) {
				let id = listItems[i].getAttribute("id");
				if(id != null) { //skip empty list item
				    let created = listItems[i].getAttribute("created");
				    let text = listItems[i].textContent;
				    text = text.substring(0,text.length -1);
				    let checked = listItems[i].classList.contains("checked");
				    let item = {id: id, created: created, text: text, checked: checked};
				    todoItems.push(item);
				}
			}
			let todoList = {id: "" + index, name: todoListName, items: todoItems};
			contents.push(todoList);
		}
    }
	changeMade = false;
    return contents;
}

