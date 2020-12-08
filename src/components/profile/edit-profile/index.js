module.exports = {
    template: require('edit-profile.html'),
    data: function() {
        return {
        firstName: "",
        firstNameReadyToBeShared: false,
        lastName: "",
        lastNameReadyToBeShared: false,
        biography: "",
        biographyReadyToBeShared: false,
        primaryPhone: "",
        primaryPhoneReadyToBeShared: false,
        primaryEmail: "",
        primaryEmailReadyToBeShared: false,
        profileImage: "",
        status: "",
        statusReadyToBeShared: false,
        webRoot: "",
        webRootReadyToBePublished: false,
        webRootUrl: "",
        previousFirstName: "",
        previousLastName: "",
        previousBiography: "",
        previousPrimaryPhone: "",
        previousPrimaryEmail: "",
        previousStatus: "",
        previousWebRoot: "",
        BIO_MAX_LENGTH: 200,
        STATUS_MAX_LENGTH: 50,
        FIRSTNAME_MAX_LENGTH: 25,
        LASTNAME_MAX_LENGTH: 25,
        PHONE_MAX_LENGTH: 15,
        EMAIL_MAX_LENGTH: 50,
        WEBROOT_MAX_LENGTH: 40,
        showSpinner: false,
        spinnerMessage: ''
        }
    },
    props: ['context', 'profile', 'messages', 'shareWith'],
    created: function() {
        this.firstName = this.previousFirstName = this.profile.firstName;
        if (this.firstName.length > 0)
            this.firstNameReadyToBeShared = true;
        this.lastName = this.previousLastName = this.profile.lastName;
        if (this.lastName.length > 0)
            this.lastNameReadyToBeShared = true;
        this.biography = this.previousBiography = this.profile.biography;
        if (this.biography.length > 0)
            this.biographyReadyToBeShared = true;
        this.primaryPhone = this.previousPrimaryPhone = this.profile.primaryPhone;
        if (this.primaryPhone.length > 0)
            this.primaryPhoneReadyToBeShared = true;
        this.primaryEmail = this.previousPrimaryEmail = this.profile.primaryEmail;
        if (this.primaryEmail.length > 0)
            this.primaryEmailReadyToBeShared = true;
        this.status = this.previousStatus = this.profile.status;
        if (this.status.length > 0)
            this.statusReadyToBeShared = true;
        this.webRoot = this.previousWebRoot = this.profile.webRoot;
        if (this.webRoot.length > 0) {
            let that = this;
            let directoryPath = peergos.client.PathUtils.directoryToPath(this.webRoot.split('/'));
            this.context.getPublicFile(directoryPath).thenApply(res => {
                if(res.isPresent()) {
                    that.webRootReadyToBePublished = false;
                    that.webRootUrl = "https://" + that.context.username+".peergos.me";
                } else {
                    that.webRootReadyToBePublished = true;
                    that.webRootUrl = "";
                }
            }).exceptionally(function(throwable) {
                that.webRootReadyToBePublished = true;
                that.webRootUrl = "";
            });
        }
        this.profileImage = this.profile.profileImage;
    },
    methods: {
        close: function () {
            this.$emit("hide-profile-edit");
        },
        showMessage: function(title, body) {
            this.messages.push({
                title: title,
                body: body,
                show: true
            });
        },
        share: function(field, fieldName) {
            this.shareWith(field, fieldName);
        },
        uploadImageFile: function(evt) {
            let files = evt.target.files || evt.dataTransfer.files;
            let file = files[0];
            let that = this;
            let filereader = new FileReader();
            filereader.file_name = file.name;
            let thumbnailWidth = 400;
            let thumbnailHeight = 400;
            filereader.onload = function(){
                let canvas = document.createElement("canvas");
                canvas.width = thumbnailWidth;
                canvas.height = thumbnailHeight;
                let context = canvas.getContext("2d");
                let image = new Image();
                image.onload = function() {
                    context.drawImage(image, 0, 0, thumbnailWidth, thumbnailHeight);
                    let binFilereader = new FileReader();
                    binFilereader.file_name = file.name;
                    binFilereader.onload = function(){
                        const data = convertToByteArray(new Int8Array(this.result));
                        that.profileImage = canvas.toDataURL();
                        let binaryThumbnail = window.atob(that.profileImage.substring("data:image/png;base64,".length));
                        var ta = new Int8Array(binaryThumbnail.length);
                        for (var i = 0; i < binaryThumbnail.length; i++) {
                            ta[i] = binaryThumbnail.charCodeAt(i);
                        }
                        that.updateThumbnail(data, convertToByteArray(ta));
                    };
                    binFilereader.readAsArrayBuffer(file);
                };
                image.onerror = function() {
                    that.showMessage("Unable to read image");
                };
                image.src = this.result;
            };
            filereader.readAsDataURL(file);
        },
        getProfileImage: function() {
            return this.profileImage;
        },
        hasProfileImage: function() {
            return this.profileImage.length > 0;
        },
        removeImage: function() {
            this.profileImage = "";
            this.updateThumbnail(peergos.shared.user.JavaScriptPoster.emptyArray(), peergos.shared.user.JavaScriptPoster.emptyArray());
        },
        update: function() {
            var that = this;
            console.log("updating profile");
            let changes = [];
            let context = this.context;
            if (this.firstName != this.previousFirstName) {
                changes.push({func: function(){
                        var future = peergos.shared.util.Futures.incomplete();
                        peergos.shared.user.ProfilePaths.setFirstName(context, that.firstName).thenApply(res => {
                            if(res) {
                                that.previousFirstName = that.firstName;
                                if (that.firstName.length == 0) {
                                    that.firstNameReadyToBeShared = false;
                                } else {
                                    that.firstNameReadyToBeShared = true;
                                }
                            }
                            future.complete(res);
                        });
                        return future;
                    }
                });
            }
            if (this.lastName != this.previousLastName) {
                changes.push({func: function(){
                        var future = peergos.shared.util.Futures.incomplete();
                        peergos.shared.user.ProfilePaths.setLastName(context, that.lastName).thenApply(res => {
                            if(res) {
                                that.previousLastName = that.lastName;
                                if (that.lastName.length == 0) {
                                    that.lastNameReadyToBeShared = false;
                                } else {
                                    that.lastNameReadyToBeShared = true;
                                }
                            }
                            future.complete(res);
                        });
                        return future;
                    }
                });
            }
            if (this.biography != this.previousBiography) {
                changes.push({func: function(){
                        var future = peergos.shared.util.Futures.incomplete();
                        peergos.shared.user.ProfilePaths.setBio(context, that.biography).thenApply(res => {
                            if(res) {
                                that.previousBiography = that.biography;
                                if (that.biography.length == 0) {
                                    that.biographyReadyToBeShared = false;
                                } else {
                                    that.biographyReadyToBeShared = true;
                                }
                            }
                            future.complete(res);
                        });
                        return future;
                    }
                });
            }
            if (this.primaryPhone != this.previousPrimaryPhone) {
                changes.push({func: function(){
                        var future = peergos.shared.util.Futures.incomplete();
                        peergos.shared.user.ProfilePaths.setPhone(context, that.primaryPhone).thenApply(res => {
                            if(res) {
                                that.previousPrimaryPhone = that.primaryPhone;
                                if (that.primaryPhone.length == 0) {
                                    that.primaryPhoneReadyToBeShared = false;
                                } else {
                                    that.primaryPhoneReadyToBeShared = true;
                                }
                            }
                            future.complete(res);
                        });
                        return future;
                    }
                });
            }
            if (this.primaryEmail != this.previousPrimaryEmail) {
                changes.push({func: function(){
                        var future = peergos.shared.util.Futures.incomplete();
                        peergos.shared.user.ProfilePaths.setEmail(context, that.primaryEmail).thenApply(res => {
                            if(res) {
                                that.previousPrimaryEmail = that.primaryEmail;
                                if (that.primaryEmail.length == 0) {
                                    that.primaryEmailReadyToBeShared = false;
                                } else {
                                    that.primaryEmailReadyToBeShared = true;
                                }
                            }
                            future.complete(res);
                        });
                        return future;
                    }
                });
            }
            if (this.status != this.previousStatus) {
                changes.push({func: function(){
                        var future = peergos.shared.util.Futures.incomplete();
                        peergos.shared.user.ProfilePaths.setStatus(context, that.status).thenApply(res => {
                            if(res) {
                                that.previousStatus = that.status;
                                if (that.status.length == 0) {
                                    that.statusReadyToBeShared = false;
                                } else {
                                    that.statusReadyToBeShared = true;
                                }
                            }
                            future.complete(res);
                        });
                        return future;
                    }
                });
            }
            if (this.webRoot == this.previousWebRoot) {
                this.saveChanges(changes); // save other changes
            } else {
                var updatedPath = this.webRoot.trim();
                let changeWebRootFunc = function(){
                    var publishFuture = peergos.shared.util.Futures.incomplete();
                    var unPublishFuture = peergos.shared.util.Futures.incomplete();
                    if (that.previousWebRoot.length > 0) {
                        that.unpublishWebroot(unPublishFuture);
                    } else {
                        unPublishFuture.complete(true);
                    }
                    unPublishFuture.thenApply(done => {
                        peergos.shared.user.ProfilePaths.setWebRoot(context, updatedPath).thenApply(res => {
                            that.$emit("update-refresh");
                            if(res) {
                                that.webRoot = updatedPath;
                                that.previousWebRoot = updatedPath;
                                if (updatedPath.length == 0) {
                                    that.webRootReadyToBePublished = false;
                                } else {
                                    that.webRootReadyToBePublished = true;
                                }
                                that.webRootUrl = "";
                            }
                            publishFuture.complete(res);
                        });
                    });
                    return publishFuture;
                }
                if(updatedPath == '') {
                    changes.push({func: changeWebRootFunc});
                    this.saveChanges(changes);
                } else if (updatedPath == '/') {
                    that.showMessage("Validation Error", "Web Directory not set. Changes not saved!");
                } else {
                    if (updatedPath.endsWith('/')) {
                        updatedPath = updatedPath.substring(0, updatedPath.length -1);
                    }
                    if (updatedPath.startsWith('/')) {
                        updatedPath = updatedPath.substring(1);
                    }
                    if (updatedPath == '') {
                        this.showMessage("Validation Error", "Web Directory not set. Changes not saved!");
                    } else {
                        if (!updatedPath.startsWith(this.context.username+ '/')) {
                            updatedPath = this.context.username + '/' + updatedPath;
                        }
                        if (updatedPath == '' || updatedPath == this.context.username + '/' + this.context.username) {
                            this.showMessage("Validation Error", "Web Directory not set. Changes not saved!");
                        } else {
                            try {
                                let dirPath = peergos.client.PathUtils.directoryToPath(updatedPath.split('/'));
                                this.context.getByPath(dirPath.toString()).thenApply(function(dirOpt){
                                        if (dirOpt.isEmpty()) {
                                            that.showMessage("Validation Error", "Web Directory not found. Changes not saved!");
                                        } else {
                                            changes.push({func: changeWebRootFunc});
                                            that.saveChanges(changes);
                                        }
                                });
                            } catch (pathException) {
                                that.showMessage("Validation Error", "Web Directory not valid. Changes not saved!");
                            }
                        }
                    }
                }
            }
        },
        unpublishWebroot: function(future) {
            let that = this;
            peergos.shared.user.ProfilePaths.unpublishWebRoot(this.context).thenApply(function(success){
                that.$emit("update-refresh");
                future.complete(true);
            });
        },
        publishWebroot: function() {
            let that = this;
            if (this.webRoot.length > 0) {
                that.showSpinner = true;
                try {
                    let dirPath = peergos.client.PathUtils.directoryToPath(this.webRoot.split('/'));
                    this.context.getByPath(dirPath.toString()).thenApply(function(dirOpt){
                        if (dirOpt.isEmpty()) {
                            that.showMessage("Unable to publish Web Directory", "Web Directory not found");
                        } else {
                            peergos.shared.user.ProfilePaths.publishWebroot(that.context).thenApply(function(success){
                                that.showSpinner = false;
                                that.$emit("update-refresh");
                                if (success) {
                                    that.showMessage("Web Directory published", "Available at: https://" + that.context.username+".peergos.me");
                                    that.webRootUrl = "https://" + that.context.username + ".peergos.me";
                                } else {
                                    that.showMessage("Unable to publish Web Directory", "");
                                }
                            }).exceptionally(function(throwable) {
                              that.showMessage("Unable to publish Web Directory", throwable.getMessage());
                              console.log(throwable.getMessage());
                              that.showSpinner = false;
                            });
                        }
                    });
                } catch (pathException) {
                    that.showMessage("Unable to publish Web Directory", "Web Directory not valid");
                }
            }
        },
        updateThumbnail: function(hires, thumbnail) {
            let that = this;
            console.log("updating profile image");
            that.showSpinner = true;

            peergos.shared.user.ProfilePaths.setHighResProfilePhoto(that.context, hires).thenApply(function(success){
                peergos.shared.user.ProfilePaths.setProfilePhoto(that.context, thumbnail).thenApply(function(success){
                    that.showSpinner = false;
                    that.$emit("update-refresh");
                }).exceptionally(function(throwable) {
                  that.showMessage("Unexpected error", throwable.getMessage());
                  console.log(throwable.getMessage());
                  that.showSpinner = false;
                  that.$emit("update-refresh");
                });
            }).exceptionally(function(throwable) {
              that.showMessage("Unexpected error", throwable.getMessage());
              console.log(throwable.getMessage());
              that.showSpinner = false;
            });
        },
        saveChanges: function(changes) {
            if (changes.length == 0) {
                return;
            }
            let that = this;
            this.showSpinner = true;
            this.reduceAll(changes);
        },
         reduceAll: function(changes) {
            let that = this;
            let func = changes.pop();
            if(func == null) {
                that.showMessage("Profile updated","");
                that.showSpinner = false;
                console.log("profile updated");
                that.$emit("update-refresh");
                return;
            } else {
                func.func().thenApply(function(success) {
                    if(success) {
                        that.reduceAll(changes);
                    } else {
                        that.showMessage("Unable to update profile");
                        console.log("Unable to update profile");
                        that.showSpinner = false;
                    }
                }).exceptionally(function(throwable) {
                    that.showMessage("Unexpected error", throwable.getMessage());
                    console.log('Error updating profile');
                    console.log(throwable.getMessage());
                    that.showSpinner = false;
                });
            }
         }
    }
}
