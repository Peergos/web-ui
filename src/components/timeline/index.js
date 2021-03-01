module.exports = {
    template: require('timeline.html'),
    data: function() {
        return {
            showSpinner: false,
            data: [],
            pageEndIndex : 0,
            pageSize: 20,
            requestingMoreResults: false,
            noMoreResults: false,
            showSocialPostForm: false,
            socialPostAction: '',
            currentSocialPostEntry: null,
            unresolvedSharedItems: []
        }
    },
    props: ['context','navigateToAction','viewAction', 'messages', 'getFileIconFromFileAndType', 'socialFeed',
        'importCalendarFile', 'importSharedCalendar', 'displayProfile', 'groups'],
    created: function() {
        let that = this;
        Vue.nextTick(function() {
            that.init();
            //TODO size scroll display area using css!
            let scrollingArea = document.getElementById('scroll-area');
            var rect = scrollingArea.getBoundingClientRect();
            scrollingArea.style["height"] = (window.innerHeight - rect.top) /10 * 9 + "px";
            let body = document.getElementsByTagName('body');
            body[0].onresize = function(){
                var rect = scrollingArea.getBoundingClientRect();
                var height = (window.innerHeight - rect.top);
                scrollingArea.style["height"] = height/10 * 9+ "px";
            };

        });
    },
    methods: {
        addNewPost: function() {
            this.currentSocialPostEntry = null;
            this.socialPostAction = 'add';
            this.showSocialPostForm = true;
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
                        if (!(this.data[i].socialPost != null
                        && this.data[i].socialPost.parent.ref != null
                        && this.data[i].socialPost.parent.ref.path == post.socialPost.parent.ref.path)){
                            break;
                        }
                    }
                    if (references.length > 0) {
                        let that = this;
                        let refPath = references[0].path;
                        this.context.getByPath(refPath).thenApply(function(optFile){
                            let file = optFile.get();
                            let media = that.createTimelineEntry(refPath, null, null, file);
                            that.data.splice(i, 0, media, post);
                        });
                    } else {
                        this.data.splice(i, 0, post);
                    }
                }
            } else {
                if (references.length > 0) {
                    let that = this;
                    let refPath = references[0].path;
                    this.context.getByPath(refPath).thenApply(function(optFile){
                        let file = optFile.get();
                        let media = that.createTimelineEntry(refPath, null, null, file);
                        that.data = [media, post].concat(that.data);
                    });
                } else {
                    this.data = [post].concat(this.data);
                }
            }
        },
        closeSocialPostForm: function(action, newPath, newSocialPost, newFile, originalPath) {
            this.showSocialPostForm = false;
            this.currentSocialPostEntry = null;
            let that = this;
            if (action == 'edit') {
                var index = this.data.findIndex(v => v.link === originalPath);
                if (index != -1) { //could of been deleted
                    this.data[index].name = newSocialPost.body;
                    this.data[index].socialPost = newSocialPost;
                    this.data[index].status = newSocialPost.previousVersions.toArray([]).length > 0 ? "Edited" : "";
                }
            } else {
                if (newSocialPost != null) {
                    this.appendToTimeline(newPath, newSocialPost, newFile, originalPath);
                }
            }
        },
        editPost: function(entry) {
            this.socialPostAction = 'edit';
            this.currentSocialPostEntry = {path: entry.link, socialPost: entry.socialPost};
            this.showSocialPostForm = true;
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
                        let refPath = references[0].path;
                        let refIndex = this.data.findIndex(v => v.link === refPath);
                        if (refIndex > -1) {
                            this.data.splice(refIndex, 1);
                        }
                    }
                }
                var done = false;
                while (!done) {
                    let childIndex = this.data.findIndex(v => v.socialPost != null
                        && v.socialPost.parent.ref != null
                        && v.socialPost.parent.ref.path === entry.link);
                    if (childIndex == -1) {
                        done = true;
                    } else {
                        this.data.splice(childIndex, 1);
                    }
                }
            }
        },
        deletePost: function(entry) {
            let that = this;
            that.showSpinner = true;
            let socialPost = entry.socialPost;
            if (socialPost.kind == peergos.shared.social.SocialPost.Type.Image
                || socialPost.kind == peergos.shared.social.SocialPost.Type.Video
                || socialPost.kind == peergos.shared.social.SocialPost.Type.Audio) {
                let ref = socialPost.references.toArray([])[0];
                this.context.getByPath(ref.path).thenApply(function(optFile){
                    let mediaFile = optFile.ref;
                    let parentPath = entry.link.substring(0, entry.link.lastIndexOf('/'));
                    that.deleteFile(parentPath + "/" + mediaFile.props.name, mediaFile).thenApply(function(res){
                        that.deleteFile(entry.link, entry.file).thenApply(function(res){
                            that.showSpinner = false;
                            if (res) {
                                that.removeItemFromDisplay(entry);
                            }
                        });
                    }).exceptionally(function(throwable) {
                        that.showMessage("error deleting media file!");
                    });
                });
            } else {
                this.deleteFile(entry.link, entry.file).thenApply(function(res){
                    that.showSpinner = false;
                    if (res) {
                        if (res) {
                            that.removeItemFromDisplay(entry);
                        }
                    }
                });
            }
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
                            future.complete(b);
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
            this.currentSocialPostEntry = {path: entry.link, socialPost: entry.socialPost, file: entry.file, cap: entry.cap};
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
                        this.viewAction(entry.path, entry.fullName);
                    }
                }
            }
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
        createTimelineEntry: function(filePath, entry, socialPost, file) {
            var displayFilename = true;
            let info = " shared";
            let isMedia = entry== null && socialPost == null ? true : false;

            let owner = entry != null ? entry.sharer : this.extractOwnerFromPath(filePath);
            if (owner == this.context.username) {
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
                info = info + socialPost.postTime.toString().replace('T',' ');
                name = socialPost.body;
                if (socialPost.previousVersions.toArray([]).length > 0) {
                    status = "Edited";
                }
            }
            let item = {
                sharer: owner, //todo handle re-sharing
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
                indent: 0,
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
        calcInsertIndex: function(allTimelineEntries, index, newEntry) {
            let parent = allTimelineEntries[index];
            var i = index +1;
            for(;i < allTimelineEntries.length; i++) {
                let entry = allTimelineEntries[i];
                if (entry.socialPost != null && entry.socialPost.parent.ref != null
                    && entry.socialPost.parent.ref.path == parent.path) {

                    if (newEntry.socialPost.postTime.compareTo(entry.socialPost.postTime) < 0){
                        break;
                    }
                }
            }
            return i;
        },
        populateTimeline: function(entries) {
            let allTimelineEntries = [];
            for(var j = 0; j < entries.length; j++) {
                let indentedRow = entries[j];
                let item = indentedRow.item;
                let media = indentedRow.media;
                if (media) {
                    let mediaTimelineEntry = this.createTimelineEntry(media.path, media.entry, media.socialPost, media.file);
                    mediaTimelineEntry.indent = indentedRow.indent;
                    allTimelineEntries.push(mediaTimelineEntry);
                }
                let timelineEntry = this.createTimelineEntry(item.path, item.entry, item.socialPost, item.file);
                timelineEntry.indent = indentedRow.indent;
                allTimelineEntries.push(timelineEntry);
            }
            return allTimelineEntries;
        },
        insertIntoEntries: function(entryTree, itemToInsert, media) {
            let parentPath = itemToInsert.socialPost.parent.ref.path;
            let newNode = entryTree.addChild(parentPath, itemToInsert, media, false);
            if (newNode == null) {
                this.unresolvedSharedItems.push(itemToInsert);
            } else {
                let unresolvedIndex = this.unresolvedSharedItems.findIndex(v => v.path === itemToInsert.path);
                if (unresolvedIndex > -1) {
                    this.unresolvedSharedItems.splice(unresolvedIndex, 1);
                }
            }
        },
        getMedia: function(mediaMap, item) {
            let references = item.socialPost.references.toArray([]);
            if (references.length > 0){
                return mediaMap.get(references[0].path);
            }
            if (item.socialPost.parent.ref != null) {
                return mediaMap.get(item.socialPost.parent.ref.path);
            }
            return null;
        },
        isStartOfThread: function(entries, item) {
            if (item.socialPost.parent.ref != null) {
                if (item.socialPost.parent.ref.path.includes("/.posts/")) {
                    return false;
                }
                //else it references either a. normal timeline entry, or inband media item
                for(var i = 0; i < entries.length; i++) {
                    if (entries[i].path == item.socialPost.parent.ref.path) {
                        return false;
                    }
                }
                if (item.socialPost.references.toArray([]).length > 0 ) {
                    throw "reference not found"
                }
            }
            return true;
        },
        Tree: function(thisRef) {
            this.methodCtx = thisRef;
            this.root = new this.methodCtx.TreeNode(null, "", null, null);
            this.nodeLookupMap = new Map();
            this.lookup = function(path) {
                return path == null ? this.root : this.nodeLookupMap.get(path);
            }
            this.addChild = function(parentPath, item, media, insertBefore) {
                let parent = this.lookup(parentPath);
                if (parent == null) {
                    return null;
                }
                let path = item.path;
                let node = new this.methodCtx.TreeNode(parent, path, item, media);
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
                accumulator.push(new this.methodCtx.IndentedRow(depth, node.item, node.media));
                let that = this;
                node.children.forEach(each => {
                    that.recurseCollect(each, depth + 1, accumulator);
                });
            }
        },
        TreeNode: function(parent, path, item, media) {
            this.path = path;
            this.item = item;
            this.media = media;
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
        IndentedRow: function(indent, item, media) {
            this.indent = indent;
            this.item = item;
            this.media = media;
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
                    entryTree.addChild(null, item, null, true);
                } else {
                    let media = that.getMedia(mediaMap, item);
                    try {
                        if (that.isStartOfThread(entryTree.root.children, item)) {
                            entryTree.addChild(null, item, media, true);
                        } else {
                            that.insertIntoEntries(entryTree, item, media);
                        }
                    } catch (ex) {
                        //skip item because of a missing reference due to unsharing/deletion
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
    }
}
