module.exports = {
    template: require('edit-profile.html'),
    data: function() {
        return {
        firstName: "",
        lastName: "",
        biography: "",
        primaryPhone: "",
        primaryEmail: "",
        profileImage: "",
        status: "",
        webRoot: "",
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
        this.lastName = this.previousLastName = this.profile.lastName;
        this.biography = this.previousBiography = this.profile.biography;
        this.primaryPhone = this.previousPrimaryPhone = this.profile.primaryPhone;
        this.primaryEmail = this.previousPrimaryEmail = this.profile.primaryEmail;
        this.status = this.previousStatus = this.profile.status;
        this.webRoot = this.previousWebRoot = this.profile.webRoot;
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
            let thumbnailWidth = 100;
            let thumbnailHeight = 100;
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
                        that.updateThumbnail(data, canvas.toDataURL());
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
            this.updateThumbnail(peergos.shared.user.JavaScriptPoster.emptyArray(), "");
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
                            }
                            future.complete(res);
                        });
                        return future;
                    }
                });
            }
            if (this.webRoot == this.previousWebRoot) {
                this.saveChanges(changes); //save other changes
            } else {
                var updatedPath = this.webRoot.trim();
                let changeWebRootFunc = function(){
                    var future = peergos.shared.util.Futures.incomplete();
                    peergos.shared.user.ProfilePaths.setWebRoot(context, updatedPath).thenApply(res => {
                        if(res) {
                            that.webRoot = updatedPath;
                            that.previousWebRoot = updatedPath;
                        }
                        future.complete(res);
                    });
                    return future;
                }
                if(updatedPath == '') {
                    changes.push({func: changeWebRootFunc});
                    this.saveChanges(changes);
                } else if (updatedPath == '/') {
                    that.showMessage("Validation Error", "Web Root directory not set. Changes not saved!");
                } else {
                    if (updatedPath.endsWith('/')) {
                        updatedPath = updatedPath.substring(0, updatedPath.length -1);
                    }
                    if (updatedPath.startsWith('/')) {
                        updatedPath = updatedPath.substring(1);
                    }
                    if (updatedPath == '') {
                        this.showMessage("Validation Error", "Web Root directory not set. Changes not saved!");
                    } else {
                        if (!updatedPath.startsWith(this.context.username+ '/')) {
                            updatedPath = this.context.username + '/' + updatedPath;
                        }
                        if (updatedPath == '' || updatedPath == this.context.username + '/' + this.context.username) {
                            this.showMessage("Validation Error", "Web Root directory not set. Changes not saved!");
                        } else {
                            try {
                                let dirPath = peergos.client.PathUtils.directoryToPath(updatedPath.split('/'));
                                this.context.getByPath(dirPath.toString()).thenApply(function(dirOpt){
                                        if (dirOpt.isEmpty()) {
                                            that.showMessage("Validation Error", "Web Root directory not found. Changes not saved!");
                                        } else {
                                            changes.push({func: changeWebRootFunc});
                                            that.saveChanges(changes);
                                        }
                                });
                            } catch (pathException) {
                                that.showMessage("Validation Error", "Web Root directory not valid. Changes not saved!");
                            }
                        }
                    }
                }
            }
        },
        updateThumbnail: function(hires, thumbnail) {
            let that = this;
            this.profileImage = thumbnail;
            console.log("updating profile image");
            that.showSpinner = true;

            peergos.shared.user.ProfilePaths.setHighResProfilePhoto(that.context, hires).thenApply(function(success){
                peergos.shared.user.ProfilePaths.setProfilePhoto(that.context, that.profileImage).thenApply(function(success){
                    that.showSpinner = false;
                }).exceptionally(function(throwable) {
                  that.showMessage("Unexpected error", throwable.getMessage());
                  console.log(throwable.getMessage());
                  that.showSpinner = false;
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
