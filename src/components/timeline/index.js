module.exports = {
    template: require('timeline.html'),
    data: function() {
        return {
            showSpinner: false,
            data: [],
            pageEndIndex : 0,
            pageSize: 4,
            requestingMoreResults: false,
            noMoreResults: false,
            showSocialPostForm: false,
            socialPostAction: '',
            currentSocialPostEntry: null,
            unresolvedSharedItems: [],
            showEmbeddedGallery: false,
            filesToViewInGallery: [],
            showEditMenu: false,
            menutop:"",
            menuleft:"",
            currentRow: {},
            showConfirm: false,
            confirm_message: "",
            confirm_body: "",
            confirm_consumer_cancel_func: () => {},
            confirm_consumer_func: () => {}
        }
    },
    props: ['context','navigateToAction','viewAction', 'messages', 'getFileIconFromFileAndType', 'socialFeed',
        'importCalendarFile', 'importSharedCalendar', 'displayProfile', 'groups'],
    created: function() {
        let that = this;
        Vue.nextTick(function() {
            that.init();
        });
    },
    methods: {
        addNewPost: function() {
            this.currentSocialPostEntry = null;
            this.socialPostAction = 'add';
            this.showSocialPostForm = true;
        },
        reduceAllMediaAppend: function(index, references, post, accumulator, future) {
            let that = this;
            if (index == references.length) {
                future.complete(accumulator);
            } else {
                let refPath = references[index].path;
                this.context.getByPath(refPath).thenApply(function(optFile){
                    let file = optFile.get();
                    let media = that.createTimelineEntry(refPath, null, null, file);
                    media.indent = post.indent;
                    accumulator.push(media);
                    that.reduceAllMediaAppend(index+1, references, post, accumulator, future);
                });
            }
        },
        appendMediaForPost: function(post, references) {
            let that = this;
            let future = peergos.shared.util.Futures.incomplete();
            that.reduceAllMediaAppend(0, references, post, [], future);
            return future;
        },
        appendToTimeline: function(newPath, newSocialPost, newFile, originalPath) {
            let post = this.createTimelineEntry(newPath, null, newSocialPost, newFile);
            let references = newSocialPost.references.toArray([]);
            if (originalPath != null) {
                let index = this.data.findIndex(v => v.link === originalPath);
                if (index > -1) {
                    let parentPostIndent = this.data[index].indent;
                    post.indent = parentPostIndent + 1;
                    var i = index +1;
                    for(;i < this.data.length; i++) {
                        if (!this.data[i].isMedia) {
                            if (this.data[i].indent == null || this.data[i].indent <= parentPostIndent){
                                break;
                            }
                        }
                    }
                    if (references.length > 0) {
                        let that = this;
                        this.appendMediaForPost(post, references).thenApply(function(timelineEntries){
                            that.data.splice(i, 0, post);
                            for(var j = 0; j < timelineEntries.length; j++) {
                                that.data.splice(i+1+j, 0, timelineEntries[j]);
                            }
                        });
                    } else {
                        this.data.splice(i, 0, post);
                    }
                }
            } else {
                if (references.length > 0) {
                    let that = this;
                    this.appendMediaForPost(post, references).thenApply(function(timelineEntries){
                        that.data = [post].concat(that.data);
                        for(var j = 0; j < timelineEntries.length; j++) {
                            that.data.splice(1+j, 0, timelineEntries[j]);
                        }
                    });
                } else {
                    this.data = [post].concat(this.data);
                }
            }
        },
        closeSocialPostForm: function(action, newPath, newSocialPost, newFile, originalPath) {
            if (newPath != null && !newPath.startsWith("/")) {
                newPath = "/" + newPath;
            }
            this.showSocialPostForm = false;
            this.currentSocialPostEntry = null;
            let that = this;
            if (action == 'edit') {
                var index = this.data.findIndex(v => v.link === originalPath);
                if (index != -1) { //could of been deleted
                    this.data[index].name = newSocialPost.body;
                    this.data[index].socialPost = newSocialPost;
                    this.data[index].status = newSocialPost.previousVersions.toArray([]).length > 0 ? "[edited]" : "";
                }
            } else {
                if (newSocialPost != null) {
                    this.appendToTimeline(newPath, newSocialPost, newFile, originalPath);
                }
            }
        },
        getPosition: function(e) {
	    var posx = 0;
	    var posy = 0;
	    
	    if (!e) var e = window.event;
	    var body = document.getElementById("modal-body");
	    var feed = document.getElementById("feed")
	    
	    if (e.clientX || e.clientY) {
		posx = e.clientX - feed.offsetLeft + document.body.scrollLeft + 
                    document.documentElement.scrollLeft;
		posy = e.clientY - body.offsetTop + document.body.scrollTop + 
                    document.documentElement.scrollTop;
	    }
	    
	    return {
		x: posx,
		y: posy
	    }
	},
	closeEditMenu: function(e) {
	    this.showEditMenu = false;
	    e.stopPropagation();
	},
	displayEditMenu: function(event, row) {
            this.currentRow = row;
	    var pos = this.getPosition(event);
	    Vue.nextTick(function() {
		var top = pos.y + 10;
		var left = pos.x - 100;
		this.menutop = top + 'px';
		this.menuleft = left + 'px';
	    }.bind(this));
            this.showEditMenu = true;
	    event.stopPropagation();
        },
        editPost: function(entry) {
            this.socialPostAction = 'edit';
            this.currentSocialPostEntry = {path: entry.link, socialPost: entry.socialPost};
            this.showSocialPostForm = true;
	    this.showEditMenu = false;
        },
        convertToPath: function(dir) {
            let dirWithoutLeadingSlash = dir.startsWith("/") ? dir.substring(1) : dir;
            return peergos.client.PathUtils.directoryToPath(dirWithoutLeadingSlash.split('/'));
        },
        removeItemFromDisplay: function(entry) {
            let index = this.data.findIndex(v => v.link === entry.link);
            if (index > -1) {
                this.data.splice(index, 1);
                if (entry.socialPost != null) {
                    let references = entry.socialPost.references.toArray([]);
                    if (references.length > 0) {
                        for(var j = 0 ; j < references.length; j++) {
                            let refPath = references[j].path;
                            let refIndex = this.data.findIndex(v => v.link === refPath);
                            if (refIndex > -1) {
                                this.data.splice(refIndex, 1);
                            }
                        }
                    }
                }
                var i = index;
                for(;i < this.data.length;) {
                    if (this.data[i].indent != null && this.data[i].indent > entry.indent){
                        this.data.splice(index, 1);
                    } else {
                        break;
                    }
                }
            }
        },
        confirmDeletePost: function(deletePostFunction, cancelFunction) {
            this.confirm_message='Are you sure you want to delete the comment?';
            this.confirm_body='';
            this.confirm_consumer_cancel_func = cancelFunction;
            this.confirm_consumer_func = deletePostFunction;
            this.showConfirm = true;
        },
        deletePost: function(entry) {
            let that = this;
            this.confirmDeletePost(
                () => { that.showConfirm = false;
                    that.deleteSocialPost(entry);
                },
                () => { that.showConfirm = false;}
            );
        },
        reduceDeletingAllMediaReferences: function(entry, references, index, future) {
            let that = this;
            if (index == references.length) {
                future.complete(true);
            } else {
                let ref = references[index];
                this.context.getByPath(ref.path).thenApply(function(optFile){
                    let mediaFile = optFile.ref;
                    if (mediaFile != null) {
                        let parentPath = entry.link.substring(0, entry.link.lastIndexOf('/'));
                        that.deleteFile(parentPath + "/" + mediaFile.props.name, mediaFile).thenApply(function(res){
                            that.reduceDeletingAllMediaReferences(entry, references, index + 1, future);
                        }).exceptionally(function(throwable) {
                            that.showMessage("error deleting media file!");
                            that.reduceDeletingAllMediaReferences(entry, references, index + 1, future);
                        });
                    } else {
                        that.reduceDeletingAllMediaReferences(entry, references, index + 1, future);
                    }
                });
            }
        },
        deleteMediaReferences: function(entry, references) {
            let future = peergos.shared.util.Futures.incomplete();
            this.reduceDeletingAllMediaReferences(entry, references, 0, future);
            return future;
        },
        deleteSocialPost: function(entry) {
            let that = this;
            that.showSpinner = true;
            let socialPost = entry.socialPost;
            if (socialPost.kind == peergos.shared.social.SocialPost.Type.Image
                || socialPost.kind == peergos.shared.social.SocialPost.Type.Video
                || socialPost.kind == peergos.shared.social.SocialPost.Type.Audio
                || socialPost.kind == peergos.shared.social.SocialPost.Type.Media) {
                this.deleteMediaReferences(entry, socialPost.references.toArray([])).thenApply(function(result){
                    that.deleteFile(entry.link, entry.file).thenApply(function(res2){
                        if (res2) {
                            that.showSpinner = false;
                            that.removeItemFromDisplay(entry);
                        }
                    });
                });
            } else {
                this.deleteFile(entry.link, entry.file).thenApply(function(res){
                    if (res) {
                        that.showSpinner = false;
                        that.removeItemFromDisplay(entry);
                    }
                });
            }
	    this.showEditMenu = false;
        },
        deleteFile: function(filePathStr, file) {
            let that = this;
            let future = peergos.shared.util.Futures.incomplete();
            let filePath = this.convertToPath(filePathStr);
            let parentPath = filePathStr.substring(0, filePathStr.lastIndexOf('/'));
            this.context.getByPath(parentPath).thenApply(function(optParent){
                that.context.getByPath(filePathStr).thenApply(function(updatedFileOpt){
                    if (updatedFileOpt.ref != null) {
                        updatedFileOpt.ref.remove(optParent.get(), filePath, that.context).thenApply(function(b){
                            future.complete(true);
                        }).exceptionally(function(throwable) {
                            that.showMessage("error deleting post");
                            that.showSpinner = false;
                            future.complete(false);
                        });
                    } else {
                        future.complete(true);
                    }
                });
            }).exceptionally(function(throwable) {
                that.showMessage("error deleting social post");
                that.showSpinner = false;
                future.complete(false);
            });
            return future;
        },
        getGroupUid: function(groupName) {
            return this.groups.groupsNameToUid[groupName];
        },
        addComment: function(entry) {
            this.socialPostAction = 'reply';
            var cap = entry.cap;
            if (cap == null) {
                cap = entry.file.readOnlyPointer();
            }
            this.currentSocialPostEntry = {path: entry.link, socialPost: entry.socialPost, file: entry.file, cap: cap};
            this.showSocialPostForm = true;
        },
        getFileSize: function(props) {
                var low = props.sizeLow();
                if (low < 0) low = low + Math.pow(2, 32);
                return low + (props.sizeHigh() * Math.pow(2, 32));
        },
        loadPost: function(file, future) {
            let that = this;
            const props = file.getFileProperties();
            file.getInputStream(this.context.network, this.context.crypto, props.sizeHigh(), props.sizeLow(), function(read){})
                .thenApply(function(reader) {
                    var size = that.getFileSize(props);
                    var data = convertToByteArray(new Int8Array(size));
                    reader.readIntoArray(data, 0, data.length).thenApply(function(read){
                        let socialPost = peergos.shared.util.Serialize.parse(data, c => peergos.shared.social.SocialPost.fromCbor(c));
                        future.complete({socialPost: socialPost, file: file});
                    });
            }).exceptionally(function(throwable) {
                that.showMessage("error loading post");
                future.complete(null);
            });
        },
        loadFile: function(entry) {
            let future = peergos.shared.util.Futures.incomplete();
            let isPost = entry.left.path.includes("/.posts/"); //TODO tighten up
            if (isPost) {
                this.loadPost(entry.right, future);
            } else {
                future.complete(null);
            }
            return future;
        },
        reduceLoadingAllFiles: function(pairs, index, accumulator, future) {
            let that = this;
            if (index == pairs.length) {
                future.complete(accumulator);
            } else {
                let currentPair = pairs[index];
                that.loadFile(currentPair).thenApply(result => {
                    let socialPost = result ? result.socialPost : null;
                    let fullPath = currentPair.left.path.startsWith("/") ? currentPair.left.path : "/" + currentPair.left.path;
                    accumulator = accumulator.concat({entry: currentPair.left, path: fullPath, socialPost: socialPost, file: currentPair.right});
                    that.reduceLoadingAllFiles(pairs, ++index, accumulator, future);
                });
            }
        },
        loadFiles: function(pairs) {
            let future = peergos.shared.util.Futures.incomplete();
            this.reduceLoadingAllFiles(pairs, 0, [], future);
            return future;
        },
        extractOwnerFromPath: function(path) {
            let pathWithoutLeadingSlash = path.startsWith("/") ? path.substring(1) : path;
            return pathWithoutLeadingSlash.substring(0, pathWithoutLeadingSlash.indexOf("/"));
        },
        reduceLoadingMediaPosts: function(refs, index, accumulator, future) {
            let that = this;
            if (index == refs.length) {
                future.complete(accumulator);
            } else {
                let ref = refs[index];
                let owner = this.extractOwnerFromPath(ref.path);
                this.context.network.getFile(ref.cap, owner).thenApply(optFile => {
                    let mediaFile = optFile.ref;
                    if (mediaFile != null) {
                        accumulator = accumulator.concat({cap: ref.cap, path: ref.path, socialPost: null, file: mediaFile});
                    }
                    that.reduceLoadingMediaPosts(refs, ++index, accumulator, future);
                })
            }
        },
        loadMediaPosts: function(sharedPosts) {
            let future = peergos.shared.util.Futures.incomplete();
            let refs = [];
            for(var i = 0; i < sharedPosts.length; i++) {
                let post = sharedPosts[i].socialPost;
                if (post != null) {
                    if (post.parent.ref != null) {
                        let index = sharedPosts.findIndex(v => v.path === post.parent.ref.path);
                        if (index == -1) {
                            //eg we shared a file that another has commented on
                            refs.push(post.parent.ref);
                        }
                    }
                    let references = post.references.toArray([]);
                    if (references.length > 0) {
                        references.forEach(mediaRef => {
                            refs.push(mediaRef);
                        }) ;
                    }
                }
            }
            this.reduceLoadingMediaPosts(refs, 0, [], future);
            return future;
        },
        handleScrolling: function() {
            let that = this;
            let scrollingDiv = document.getElementById('scroll-area');
            if (scrollingDiv.offsetHeight + scrollingDiv.scrollTop >= scrollingDiv.scrollHeight) {
                that.requestMoreResults();
            }
        },
        processItems: function(items) {
            var that = this;
            that.buildTimeline(items).thenApply(function(allTimelineEntries) {
                that.data = that.data.concat(allTimelineEntries);
                that.showSpinner = false;
                that.requestingMoreResults = false;
            });
        },
        filterSharedItems: function(items) {
            let filteredSharedItems = [];
            for(var i=0; i < items.length; i++) {
                let currentSharedItem = items[i];
                if (!currentSharedItem.path.startsWith("/" + currentSharedItem.owner + "/.profile/")
                    && !currentSharedItem.path.startsWith("/" + currentSharedItem.owner + "/shared/.")) { //groups
                    filteredSharedItems.push(currentSharedItem);
                }
            }
            return filteredSharedItems;
        },
        requestMoreResults: function() {
            let that = this;
            if (that.noMoreResults || that.requestingMoreResults) {
                return;
            }
            that.showSpinner = true;
            that.requestingMoreResults = true;
            let startIndex = Math.max(0, this.pageEndIndex - this.pageSize);
            this.retrieveResults(startIndex, this.pageEndIndex).thenApply(function(additionalItems) {
               that.pageEndIndex = that.pageEndIndex - additionalItems.length;
               let items = that.filterSharedItems(additionalItems.reverse());
               if (items.length == 0) {
                    that.showSpinner = false;
                    that.requestingMoreResults = false;
                    that.noMoreResults = true;
                    that.data = that.data.concat({isLastEntry: true});
               } else {
                    that.processItems(items);
               }
            }).exceptionally(function(throwable) {
                that.showMessage(throwable.getMessage());
                that.showSpinner = false;
                that.requestingMoreResults = false;
            });
        },
        showMessage: function(title, body) {
            this.messages.push({
                title: title,
                body: body,
                show: true
            });
        },
        navigateTo: function (entry) {
            this.close();
            this.navigateToAction(entry.path);
        },
        view: function (entry) {
            var filename = entry.file.getName();
            if (this.isSharedCalendar(entry.path)) {
                this.importSharedCalendar(entry.path, entry.file, false, entry.file.getOwnerName());
            } else {
                var mimeType = entry.file.getFileProperties().mimeType;
                console.log("Opening " + mimeType);
                if (mimeType === "text/calendar") {
                    this.importCalendarFile(false, entry.file);
                } else {
                    if (entry.isDirectory) {
                        this.navigateToAction(entry.path);
                        this.close();
                    } else {
                        this.openInGallery(entry);
                    }
                }
            }
        },
        viewMediaList: function (mediaList, mediaIndex) {
            let files = [];
            for(var i = mediaIndex; i < mediaList.length; i++) {
                files.push(mediaList[i].file);
            }
            for(var j = 0; j < mediaIndex; j++) {
                files.push(mediaList[j].file);
            }
            this.filesToViewInGallery = files;
            this.showEmbeddedGallery = true;
        },
        openInGallery: function (entry) {
            this.filesToViewInGallery = [entry.file];
            this.showEmbeddedGallery = true;
        },
        profile: function(username) {
            this.displayProfile(username, false);
        },
        isSharedCalendar: function(path) {
            let pathParts = path.split("/");
            return pathParts.length == 6 && pathParts[0] == '' &&
                pathParts[2] == '.apps' &&
                pathParts[3] == 'calendar' &&
                pathParts[4] == 'data';
        },
        indent: function(item) {
            let calcMargin = (item.indent * 20) + 10;
            return "" +  calcMargin + "px";
        },
        fromUTCtoLocal: function(postTime) {
            let date = new Date(postTime.toString());
            let localStr =  date.toISOString().replace('T',' ');
            let withoutMS = localStr.substring(0, localStr.indexOf('.'));
            return withoutMS;
        },
        createTimelineEntry: function(filePath, entry, socialPost, file) {
            var displayFilename = true;
            let info = " shared";
            let isMedia = entry== null && socialPost == null  && filePath.includes("/.posts/") && filePath.includes("/media/") ? true : false;

            let sharer = entry != null ? entry.sharer : this.extractOwnerFromPath(filePath);
            if (sharer == this.context.username) {
                info = "you" + info;
            }
            if (socialPost == null && filePath.includes("/.posts/")) {
                displayFilename = false;
            }
            if(entry != null && entry.cap.isWritable() ) {
                info = info + " write access to";
            }
            let props = file.props;
            var isSharedCalendar = false;
            if (props.isHidden) {
                if (this.isSharedCalendar(filePath)) {
                    isSharedCalendar = true;
                } else {
                    return null;
                }
            }
            if (props.isDirectory) {
                if (isSharedCalendar) {
                    info = info + " a calendar"; // - " + props.name;
                    displayFilename = false;
                } else {
                    info = info + " the folder";
                }
            } else if (props.getType() == 'calendar') {
                info = info + " a calendar event";
                displayFilename = false;
            } else {
                info = info + " the file";
            }
            if (entry !=null && entry.sharer != entry.owner) {
                info = info + " owned by " + entry.owner;
            }
            info = info + ": ";
            let path = props.isDirectory ? filePath : filePath.substring(0, filePath.lastIndexOf(props.name) -1);
            let name = props.name.length > 30 ? props.name.substring(0,27) + '...' : props.name;
            let fileType = isSharedCalendar ? 'calendar' : props.getType();
            let isPost = socialPost != null;
            var status = "";
            if (isPost) {
                let isReply = socialPost.parent.ref != null;
                var identity = socialPost.author == this.context.username ? "you " : "";

                info = isReply ? "commented at " : "posted at ";
                info = identity + info;
                info = info + this.fromUTCtoLocal(socialPost.postTime);
                name = socialPost.body;
                if (socialPost.previousVersions.toArray([]).length > 0) {
                    status = "[edited]";
                }
            }
            let item = {
                sharer: sharer,
                info: info,
                link: filePath,
                cap: entry == null ? null : entry.cap,
                path: path,
                name: name,
                fullName: props.name,
                hasThumbnail: props.thumbnail.ref != null,
                thumbnail: props.thumbnail.ref == null ? null : file.getBase64Thumbnail(),
                isDirectory: props.isDirectory,
                file: file,
                isLastEntry: false,
                displayFilename: displayFilename,
                fileType: fileType,
                isPost: isPost,
                socialPost: socialPost,
                indent: 1,
                status: status,
                isMedia: isMedia
            };
            return item;
        },
        getFileIconClass: function(file) {
            return this.getFileIcon(file);
        },
	    retrieveUnSeen: function(startIndex, requestSize, results) {
	        var future = peergos.shared.util.Futures.incomplete();
	        this.retrieveUnSeenWithFuture(startIndex, requestSize, results, future);
	        return future;
        },
	    retrieveUnSeenWithFuture: function(startIndex, requestSize, results, future) {
	        if (! this.socialFeed.hasUnseen() ) {
	            future.complete(results);
	        } else {
                var ctx = this.context;
                let that = this;
                this.socialFeed.getShared(startIndex, startIndex + requestSize, ctx.crypto, ctx.network).thenApply(function(items) {
                    let allEntries = items.toArray();
                    let newIndex = startIndex + allEntries.length;
                    that.socialFeed.setLastSeenIndex(newIndex).thenApply(function(res) {
                        that.retrieveUnSeenWithFuture(newIndex, requestSize, results.concat(allEntries), future);
                    }).exceptionally(function(throwable) {
                        that.showMessage(throwable.getMessage());
                        that.showSpinner = false;
                    });
                }).exceptionally(function(throwable) {
                    that.showMessage(throwable.getMessage());
                    that.showSpinner = false;
                });
            }
            return future;
        },
	    retrieveResults: function(startIndex, endIndex) {
	        var future = peergos.shared.util.Futures.incomplete();
	        if(startIndex < 0 || startIndex >= endIndex) {
    	        future.complete([]);
	            return future;
	        }
            var ctx = this.context;
            this.socialFeed.getShared(startIndex, endIndex, ctx.crypto, ctx.network).thenApply(function(items) {
                future.complete(items.toArray());
            }).exceptionally(function(throwable) {
                that.showMessage(throwable.getMessage());
                that.showSpinner = false;
            });
            return future;
	    },
        populateTimeline: function(entries) {
            let allTimelineEntries = [];
            for(var j = 0; j < entries.length; j++) {
                let indentedRow = entries[j];
                let item = indentedRow.item;
                let timelineEntry = this.createTimelineEntry(item.path, item.entry, item.socialPost, item.file);
                timelineEntry.indent = indentedRow.indent;
                allTimelineEntries.push(timelineEntry);
                let mediaList = indentedRow.mediaList;
                if (mediaList.length > 0) {
                    for(var k=0; k < mediaList.length; k++) {
                        let mediaTimelineEntry = this.createTimelineEntry(mediaList[k].path, null, null, mediaList[k].file);
                        mediaTimelineEntry.indent = indentedRow.indent;
                        allTimelineEntries.push(mediaTimelineEntry);
                    }
                }
            }
            return allTimelineEntries;
        },
        insertIntoEntries: function(entryTree, itemToInsert, mediaList) {
            let parentPath = itemToInsert.socialPost.parent.ref.path;
            let newNode = entryTree.addChild(parentPath, itemToInsert, mediaList, false);
            if (newNode == null) {
                this.unresolvedSharedItems.push(itemToInsert);
            } else {
                let unresolvedIndex = this.unresolvedSharedItems.findIndex(v => v.path === itemToInsert.path);
                if (unresolvedIndex > -1) {
                    this.unresolvedSharedItems.splice(unresolvedIndex, 1);
                }
            }
        },
        Tree: function(thisRef) {
            this.methodCtx = thisRef;
            this.root = new this.methodCtx.TreeNode(null, "", null, null);
            this.nodeLookupMap = new Map();
            this.lookup = function(path) {
                return path == null ? this.root : this.nodeLookupMap.get(path);
            }
            this.addChild = function(parentPath, item, mediaList, insertBefore) {
                let parent = this.lookup(parentPath);
                if (parent == null) {
                    return null;
                }
                let path = item.path;
                let node = new this.methodCtx.TreeNode(parent, path, item, mediaList);
                this.nodeLookupMap.set(path, node);
                parent.addChild(node, insertBefore);
                return node;
            }
            this.collect = function() {
                let accumulator = [];
                this.recurseCollect(this.root, 0, accumulator);
                return accumulator.slice(1);
            }
            this.recurseCollect = function(node, depth, accumulator) {
                accumulator.push(new this.methodCtx.IndentedRow(depth, node.item, node.mediaList));
                let that = this;
                node.children.forEach(each => {
                    that.recurseCollect(each, depth + 1, accumulator);
                });
            }
        },
        TreeNode: function(parent, path, item, mediaList) {
            this.path = path;
            this.item = item;
            this.mediaList = mediaList;
            this.children = [];
            this.parent = parent;
            this.addChild = function(node, insertBefore) {
                if (insertBefore) {
                    this.children.unshift(node);
                } else {
                    this.children.push(node);
                }
            }
        },
        IndentedRow: function(indent, item, mediaList) {
            this.indent = indent;
            this.item = item;
            this.mediaList = mediaList;
        },
        isStartOfThread: function(entries, mediaMap, item) {
            if (item.socialPost.parent.ref != null) {
                return false;
            }
            return true;
        },
        organiseEntries: function(sharedItems, mediaPosts) {
            let that = this;
            let mediaMap = new Map()
            let socialPostReplies = [];
            mediaPosts.forEach(post => {
                mediaMap.set(post.path, post);
            });
            let entryTree = new this.Tree(this);
            let allSharedItems = this.unresolvedSharedItems.concat(sharedItems);
            allSharedItems.reverse().forEach(item => {
                if (item.socialPost == null) {
                    entryTree.addChild(null, item, [], true);
                } else {
                    let wasCommentOnSharedItem = false;
                    if (item.socialPost.parent.ref != null && !item.socialPost.parent.ref.path.includes("/.posts/")) {
                        if (entryTree.lookup(item.socialPost.parent.ref.path) == null) {
                            let sharedItemParent= mediaMap.get(item.socialPost.parent.ref.path);
                            entryTree.addChild(null, sharedItemParent, [], true);
                        }
                        wasCommentOnSharedItem = true;
                    }

                    let references = item.socialPost.references.toArray([]);
                    var mediaList = [];
                    if (references.length > 0){
                        for(var j = 0; j < references.length; j++) {
                            let media = mediaMap.get(references[j].path);
                            if (media != null) {
                                mediaList.push(media);
                            }
                        }
                    }
                    if (!wasCommentOnSharedItem && that.isStartOfThread(entryTree.root.children, mediaMap, item)) {
                        entryTree.addChild(null, item, mediaList, true);
                    } else {
                        that.insertIntoEntries(entryTree, item, mediaList);
                    }
                }
            });
            return entryTree.collect();
        },
        buildTimeline: function(items) {
            let that = this;
            let future = peergos.shared.util.Futures.incomplete();
            this.context.getFiles(peergos.client.JsUtil.asList(items)).thenApply(function(pairs) {
                let allPairs = pairs.toArray();
                that.loadFiles(allPairs).thenApply(function(sharedItems) {
                    that.loadMediaPosts(sharedItems).thenApply(function(mediaPosts) {
                        let entries = that.organiseEntries(sharedItems, mediaPosts);
                        let allTimelineEntries = that.populateTimeline(entries);
                        future.complete(allTimelineEntries);
                    });
                });
            });
            return future;
        },
	    init: function() {
            var that = this;
            that.showSpinner = true;
            this.pageEndIndex = this.socialFeed.getLastSeenIndex();
            this.retrieveUnSeen(this.pageEndIndex, this.pageSize, []).thenApply(function(unseenItems) {
                let startIndex = Math.max(0, that.pageEndIndex - that.pageSize);
                that.retrieveResults(startIndex, that.pageEndIndex, []).thenApply(function(additionalItems) {
                    that.pageEndIndex = that.pageEndIndex - additionalItems.length;
                    let items = that.filterSharedItems(unseenItems.reverse().concat(additionalItems.reverse()));
                    var numberOfEntries = items.length;
                    if (numberOfEntries == 0) {
                        that.data = [];
                        that.showSpinner = false;
                    } else {
                        that.buildTimeline(items).thenApply(function(timelineEntries) {
                            that.data = timelineEntries;
                            that.showSpinner = false;
                        });
                    }
                }).exceptionally(function(throwable) {
                    that.showMessage(throwable.getMessage());
                    that.showSpinner = false;
                });
            }).exceptionally(function(throwable) {
                that.showMessage(throwable.getMessage());
                that.showSpinner = false;
            });
        },
        close: function () {
            this.$emit("hide-timeline");
        }
    },
    computed: {
    	blocks: function() {
            if (this.data == null || this.data.length == 0) {
                return [];
            }
            let blocks = [];
            let thread = [];
            let associatedMedia = {isMedia: true, mediaList: []};
            this.data.forEach(timelineEntry => {
                let isSharedItem = !timelineEntry.isMedia && timelineEntry.entry == null && timelineEntry.socialPost == null;
                if (isSharedItem || timelineEntry.isLastEntry) {
                    if (thread.length > 0) {
                        thread.push(associatedMedia);
                        blocks.push(thread);
                        thread = [];
                    }
                    thread.push(timelineEntry);
                    thread.push(associatedMedia);
                    blocks.push(thread);
                    thread = [];
                    associatedMedia = {isMedia: true, mediaList: []};
                } else {
                    if (!timelineEntry.isMedia) {
                        if (timelineEntry.indent == 1 && thread.length > 0) {
                            thread.push(associatedMedia);
                            blocks.push(thread);
                            thread = [];
                            associatedMedia = {isMedia: true, mediaList: []};
                            thread.push(timelineEntry);
                        } else {
                            if (associatedMedia.mediaList.length > 0) {
                                thread.push(associatedMedia);
                                associatedMedia = {isMedia: true, mediaList: []};
                            }
                            thread.push(timelineEntry);
                        }
                    } else {
                        associatedMedia.indent = timelineEntry.indent;
                        associatedMedia.mediaList.push(timelineEntry);
                    }
                }
            });
            if (thread.length > 0) {
                thread.push(associatedMedia);
                blocks.push(thread);
            }
            return blocks;
        }
    }
}
