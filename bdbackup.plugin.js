//META{"name":"bdbackup","version":"0.0.1","website":"https://github.com/Kemono-Kay/bdbackup","source":"https://raw.githubusercontent.com/Kemono-Kay/bdbackup/master/bdbackup.plugin.js"}*//


var
	fs = require('fs'),
	request = require('request'),
	path = require('path');

class bdbackup {
	
	constructor() {
		this.modules = {
			getGuilds: 'getGuilds',
			getGuild: 'getGuild',
			createInvite: 'createInvite',
			acceptInvite: 'acceptInvite',
			getDefaultChannel: 'getDefaultChannel',
			
			getFriendIDs: 'getFriendIDs',
			getUser: 'getUser',
			sendRequest: 'sendRequest',
			isFriend: 'isFriend',
		};
		
		this.dir = path.join( __dirname, this.getShortName() );
		this.mismatchedGuilds = [];
		this.mismatchedUsers = [];
		this.guildInvitesTodo = [];
	}
	
	module( module, ...args ) {
		return BdApi.findModuleByProps( module )[ module ]( ...args );
	}
	
	getName() { return "BetterDiscordBackup"; }
	getShortName() { return "bdbackup"; }
	getDescription() { return "Backs up your friends and servers locally so you don't lose them if you forget your password or something"; }
	getVersion() { return "0.0.1"; }
	getAuthor() { return "Kemono-Kay"; }
	load() {
		fs.mkdir( this.dir, ( err ) => { if ( err ) console.warn( 'Caught (in callback)\n', err ); } );
		fs.mkdir( path.join( this.dir, this.dataNames.guild ), ( err ) => { if ( err ) console.warn( 'Caught (in callback)\n', err ); } );
		fs.mkdir( path.join( this.dir, this.dataNames.user ), ( err ) => { if ( err ) console.warn( 'Caught (in callback)\n', err ); } );
	}
	stop() {
		clearInterval( this.fillMissingGuildInvitesInterval );
		BdApi.clearCSS( this.getShortName() );
	}
	start() {
		this.fillMissingGuildData();
		this.fillMissingGuildInvitesInterval = setInterval( this.fillMissingGuildInvites, 20000, this );
		this.fillMissingUserData();
		this.findMismatchedGuilds();
		this.findMismatchedUsers();
		
		BdApi.clearCSS( this.getShortName() );
		BdApi.injectCSS( this.getShortName(), this.css );
	}
	
	forceBackup() {
		let users = this.getLog( this.dataNames.user );
		for( let user of this.module( this.modules.getFriendIDs ) ) {
			new Promise( (resolve, reject) => {
				this.createUser( user );
				resolve();
			} );
		}
		for( let guild in this.module( this.modules.getGuilds ) ) {
			new Promise( (resolve, reject) => {
				this.createGuild( guild );
				resolve();
			} );
		}
		this.fillMissingGuildData();
	}
	
	get css() {
		return `
			.${this.getShortName()}-entry {
				padding: 5px;
				border-radius: 5px;
				flex: 1 1 auto;
				display: flex;
			}
			
			.${this.getShortName()}-mismatch {
				background: #7289da;
			}
			
			.${this.getShortName()}-avatar {
				flex: 0 1 auto;
				width: 50px;
				height: 50px;
				clip-path: circle( 50% );
				margin-right: 10px;
			}
			
			.${this.getShortName()}-info {
				flex: 1;
			}
			.${this.getShortName()}-options {
				display: flex;
				align-self: center;
				justify-content: flex-end;
				background: rgb(41,43,47);
				border-radius: 5px;
				
			}
			
			.${this.getShortName()}-options > button{
				margin: 0.2em;
			}
			
			#plugin-settings-BetterDiscordBackup .da-acronym {
				width: 50px;
				height: 50px;
			}
			
			#plugin-settings-BetterDiscordBackup h1,
			.${this.getShortName()}-info > h2 {
				color:var(--channels-default);
				display: block;
				color: #b9bbbe;
				letter-spacing: .5px;
				text-transform: uppercase;
				margin-bottom: 8px;
				font-weight: 600;
				line-height: 16px;
				user-select: none;
			}
			.${this.getShortName()}-info > h2 {
				font-size: 12px;
			}
			#plugin-settings-BetterDiscordBackup h1 {
				font-size: 14px;
				margin: 1em 0.5em;
			}
			
			.${this.getShortName()}-mismatch .${this.getShortName()}-info > h2 {
				color: white;
			}
			
			.${this.getShortName()}-info span:last-child {
			    opacity: 0.5;
			}
			
			.${this.getShortName()}-backup {
			    margin: 0.5em auto;
				height: 3em;
			}
		`;
	}
	
	getSettingsPanel() {
		this.findMismatchedGuilds();
		this.findMismatchedUsers();
		let settings = document.createElement( 'div' );
		let backupButton = document.createElement( 'button' );
		backupButton.className = `userInfoViewingButton-2-jbH9 da-userInfoViewingButton button-38aScr da-button lookFilled-1Gx00P colorBrand-3pXr91 sizeSmall-2cSMqn grow-q77ONN da-grow ${this.getShortName()}-backup`;
		backupButton.addEventListener( 'click', ( e ) => {
			this.forceBackup();
			BdApi.showToast( 'Making a backup!', { type: 'info' } );
			document.getElementById('plugin-settings-BetterDiscordBackup').firstChild.remove();
			document.getElementById('plugin-settings-BetterDiscordBackup').appendChild(this.getSettingsPanel());
		} );
		backupButton.appendChild( document.createTextNode( 'Force backup' ) );
		settings.appendChild(backupButton);
		
		let users = document.createElement( 'div' );
		let userTitle = document.createElement( 'h1' );
		userTitle.appendChild( document.createTextNode( 'Friends' ) );
		users.appendChild( userTitle );
		let localUsers = this.getLog( this.dataNames.user );
		for ( let user in localUsers ) {
			let entry = document.createElement( 'div' );
			entry.className = `${this.getShortName()}-entry`;
			if ( this.mismatchedUsers.includes( user ) )
				entry.className += ` ${this.getShortName()}-mismatch`
			
			let info = document.createElement( 'div' );
			info.className += ` ${this.getShortName()}-info`
			let username = document.createElement( 'h2' );
			username.appendChild( document.createTextNode( 'Username' ) );
			let username_ = document.createElement( 'div' );
			let name = document.createElement( 'span' );
			name.appendChild( document.createTextNode( localUsers[ user ].username ) ) ;
			let disc = document.createElement( 'span' );
			disc.appendChild( document.createTextNode( '#' + localUsers[ user ].discriminator ) ) ;
			
			let options = document.createElement( 'div' );
			options.className = `${this.getShortName()}-options`
			if ( this.mismatchedUsers.includes( user ) ) {
				let del = document.createElement( 'button' );
				del.className = 'button-38aScr da-button lookOutlined-3sRXeN colorRed-1TFJan sizeSmall-2cSMqn grow-q77ONN da-grow';
				let del_ = document.createElement( 'div' );
				del_.className = 'contents-18-Yxp da-contents';
				del_.appendChild( document.createTextNode( 'Delete Backup' ) );
				del.addEventListener( 'click', ( e ) => {
					if ( localUsers[ user ].image )
					if ( typeof localUsers[ user ].image == 'string' ){
						fs.unlink( path.format({ dir: path.join( this.dir, this.dataNames.user ), name: localUsers[ user ].image }), ( err ) => {
							if ( err ) {
								console.warn( 'Caught (in callback)', err );
							}
						} );
					}
					this.removeMember( this.dataNames.user, localUsers[ user ] );
					entry.remove();
					BdApi.showToast( 'User successfully removed!', { type: 'success' } )
				}, {once: true} );
				
				let re = document.createElement( 'button' );
				re.className = 'button-38aScr da-button lookFilled-1Gx00P colorGreen-29iAKY sizeSmall-2cSMqn grow-q77ONN da-grow';
				let re_ = document.createElement( 'div' );
				re_.className = 'contents-18-Yxp da-contents';
				re_.appendChild( document.createTextNode( 'Add Friend' ) );
				re.addEventListener( 'click', ( e ) => {
					re.remove();
					del.remove();
					entry.classList.remove( `${this.getShortName()}-mismatch` );
					this.module( this.modules.sendRequest, localUsers[ user ].username + '#' + localUsers[ user ].discriminator ).then(()=>{
						BdApi.showToast( 'Friend request sent!', { type: 'success' } )
					}).catch(()=>{
						BdApi.showToast( 'Couldn\'t send friend request!', { type: 'danger' } )
					});
				}, {once: true} );
				
				del.appendChild(del_);
				re.appendChild(re_);
				options.appendChild(del);
				options.appendChild(re);
			}
			
			let avatar = document.createElement( 'div' );
			avatar.className = `${this.getShortName()}-avatar da-wrapper wrapper-3t9DeA`;
			avatar.role = 'img';
			avatar.setAttribute( 'aria-hidden', localUsers[ user ].username );
			avatar.setAttribute( 'aria-label', 'false' );
			if ( localUsers[ user ].image ) {
				let img = document.createElement( 'img' );
				img.className = 'da-avatar avatar-VxgULZ';
				img['aria-hidden'] = 'true';
				if ( typeof localUsers[ user ].image == 'string' ) {
					fs.readFile( 
						path.format({ dir: path.join( this.dir, this.dataNames.user ), name: localUsers[ user ].image }),
						'binary',
						( error, data ) => {
							img.src = 'data:image/png;base64,' + Buffer.from( data, 'binary' ).toString('base64');
						}
					);
				} else {
					img.src = localUsers[ user ].image;
				}
				avatar.appendChild(img);
			}
			username_.appendChild(name);
			username_.appendChild(disc);
			info.appendChild(username);
			info.appendChild(username_);
			entry.appendChild(avatar);
			entry.appendChild(info);
			if ( this.mismatchedUsers.includes( user ) )
				entry.appendChild(options);
			users.appendChild(entry);
		}
		settings.appendChild( users );
		
		//Guilds
		let guilds = document.createElement( 'div' );
		let guildTitle = document.createElement( 'h1' );
		guildTitle.appendChild( document.createTextNode( 'Servers' ) );
		guilds.appendChild( guildTitle );
		let localGuilds = this.getLog( this.dataNames.guild );
		for ( let guild in localGuilds ) {
			let entry = document.createElement( 'div' );
			entry.className = `${this.getShortName()}-entry`;
			if ( this.mismatchedGuilds.includes( guild ) )
				entry.className += ` ${this.getShortName()}-mismatch`
			
			let info = document.createElement( 'div' );
			info.className += ` ${this.getShortName()}-info`
			let guildname = document.createElement( 'h2' );
			guildname.appendChild( document.createTextNode( 'Server Name' ) );
			let guildname_ = document.createElement( 'div' );
			guildname_.appendChild( document.createTextNode( localGuilds[ guild ].name ) ) ;
			
			let options = document.createElement( 'div' );
			options.className = `${this.getShortName()}-options`
			if ( this.mismatchedGuilds.includes( guild ) ) {
				let del = document.createElement( 'button' );
				del.className = 'button-38aScr da-button lookOutlined-3sRXeN colorRed-1TFJan sizeSmall-2cSMqn grow-q77ONN da-grow';
				let del_ = document.createElement( 'div' );
				del_.className = 'contents-18-Yxp da-contents';
				del_.appendChild( document.createTextNode( 'Delete Backup' ) );
				del.addEventListener( 'click', ( e ) => {
					if ( localGuilds[ guild ].image ){
						fs.unlink( path.format({ dir: path.join( this.dir, this.dataNames.guild ), name: localGuilds[ guild ].image }), ( err ) => {
							if ( err ) {
								console.warn( 'Caught (in callback)', err );
							}
						} );
					}
					this.removeMember( this.dataNames.guild, localGuilds[ guild ] );
					entry.remove();
					BdApi.showToast( 'Server successfully removed!', { type: 'success' } )
				} );
				
				let re = document.createElement( 'button' );
				re.className = 'button-38aScr da-button lookFilled-1Gx00P colorGreen-29iAKY sizeSmall-2cSMqn grow-q77ONN da-grow';
				let re_ = document.createElement( 'div' );
				re_.className = 'contents-18-Yxp da-contents';
				re_.appendChild( document.createTextNode( 'Join' ) );
				if ( localGuilds[ guild ].invite == undefined || localGuilds[ guild ].invite == null )
					re.setAttribute( 'disabled', 'true' )
				re.addEventListener( 'click', ( e ) => {
					this.module( this.modules.acceptInvite, localGuilds[ guild ].invite ).then(()=>{
						BdApi.showToast( 'Rejoined Server!', { type: 'success' } )
					}).catch(()=>{
						BdApi.showToast( 'Couldn\'t rejoin server!', { type: 'danger' } )
					});
					let g = localGuilds[ guild ];
					this.removeMember( this.dataNames.guild, g );
					this.addMember( this.dataNames.guild, {name:g.name,id:g.id,image:g.image});
					re.remove();
					del.remove();
					entry.classList.remove( `${this.getShortName()}-mismatch` );
				} );
				
				del.appendChild(del_);
				re.appendChild(re_);
				options.appendChild(del);
				options.appendChild(re);
			}
			
			let icon = document.createElement( 'div' );
			icon.className = `${this.getShortName()}-avatar da-wrapper wrapper-3t9DeA`;
			icon.role = 'img';
			icon.setAttribute( 'aria-hidden', localGuilds[ guild ].name );
			icon.setAttribute( 'aria-label', 'false' );
			if ( localGuilds[ guild ].image ) {
				let img = document.createElement( 'img' );
				img.className = 'da-avatar avatar-VxgULZ';
				img['aria-hidden'] = 'true';
				fs.readFile( 
					path.format({ dir: path.join( this.dir, this.dataNames.guild ), name: localGuilds[ guild ].image }),
					'binary',
					( error, data ) => {
						img.src = 'data:image/png;base64,' + Buffer.from( data, 'binary' ).toString('base64');
					}
				);
				icon.appendChild(img);
			} else {
				let text = document.createElement( 'div' );
				text.className = 'childWrapper-anI2G9 acronym-2mOFsV da-childWrapper da-acronym';
				let chars = ''
				let match;
				let str = localGuilds[ guild ].name;
				
				while ( match = /(([^\w\s])|([\w])[\w]*)/g.exec( str ) ) {
					str = str.slice( match[ 0 ].length + match.index );
					if ( match[ 2 ] ) {
						chars += match[ 2 ]
					} else if ( match[ 3 ] ) {
						chars += match[ 3 ]
					}
				}
				text.appendChild( document.createTextNode( chars ) );
				icon.appendChild( text );
			}
			info.appendChild(guildname);
			info.appendChild(guildname_);
			entry.appendChild(icon);
			entry.appendChild(info);
			if ( this.mismatchedGuilds.includes( guild ) )
				entry.appendChild(options);
			guilds.appendChild(entry);
		}
		
		settings.appendChild( guilds );
		
		return settings;
	}
	
	findMismatchedGuilds() {
		this.mismatchedGuilds = [];
		let localGuilds = this.getLog( this.dataNames.guild );
		let guilds = this.module( this.modules.getGuilds );
		for( let guild in localGuilds ) {
			if (!( guild in guilds )) {
				this.mismatchedGuilds.push( guild );
			}
		}
	}
	
	findMismatchedUsers() {
		this.mismatchedUsers = [];
		let localUsers = this.getLog( this.dataNames.user );
		for( let user in localUsers ) {
			if (!this.module( this.modules.isFriend,user ) ) {
				this.mismatchedUsers.push( user );
			}
		}
	}
	
	fillMissingGuildInvites( self ) {
		let id = self.guildInvitesTodo.shift();
		if ( id == undefined )
			return;
		let guild = self.module( self.modules.getGuild, id );
		console.log( 'Getting invite from:', guild )
		self.module( self.modules.createInvite, self.module( self.modules.getDefaultChannel, id ).id, { max_uses: 1, max_age: 0 } ).then((result) => {
			self.addMember( self.dataNames.guild, { id: guild.id, invite: result.body.code } );
		}).catch((result) => {
			if ( result.status == 429 ) {
				self.guildInvitesTodo.unshift( id );
			} else {
				self.addMember( self.dataNames.guild, { id: guild.id, invite: null } );
				console.warn( `Unable to create invite to guild ${guild.name}.`, `Caught (in promise)\n`, result );
			}
		});
	}
	
	fillMissingGuildData() {
		this.guildInvitesTodo = [];
		let guilds = this.getLog( this.dataNames.guild );
		for ( let guild in guilds ) {
			if (!( 'invite' in guilds[ guild ] )) {
				this.guildInvitesTodo.push( guild );
			}
		}
		for( let guild in this.module( this.modules.getGuilds ) ) {
			if (!( guild in guilds )) {
				new Promise( (resolve, reject) => {
					this.createGuild( guild );
					resolve();
				} ).then(() => {
					this.guildInvitesTodo.push( guild );
				});
				
			}
		}
	}
	
	fillMissingUserData() {
		let users = this.getLog( this.dataNames.user );
		for( let user of this.module( this.modules.getFriendIDs ) ) {
			if (!( user in users )) {
				new Promise( (resolve, reject) => {
					this.createUser( user );
					resolve();
				} );
				
			}
		}
	}
	
	downloadImage( url, filename ) { 
		return new Promise( (resolve, reject) => {
			request.head( url, ( err, res, body ) => {
				if ( err ) return reject( err );
				try {
					request( url ).pipe( fs.createWriteStream( filename, { emitClose: true } ) ).on( 'close', () => { resolve( filename ); } );
				} catch ( e ) {
					reject( e );
				}
			} );
		} );
	}
	
	createGuild( id ) {
		let guild = this.module( this.modules.getGuild, id );
		if ( guild == undefined ) throw 'Undefined Guild';
		this.addMember( this.dataNames.guild, { id: guild.id, name: guild.name } );
		
		try {
			let url = guild.getIconURL( 'png' );
			if ( url == undefined )
				throw 'Undefined Icon';
			let ext = path.extname( url );
			ext = ext.slice( 0, ext.indexOf( '?' ) );
			this.downloadImage( url, path.format({ dir: path.join( this.dir, this.dataNames.guild ), name: guild.id, ext: ext }) ).then((result) => {
				this.addMember( this.dataNames.guild, { id: guild.id, image: path.format({ name: guild.id, ext: ext }) } );
			}).catch((e)=>{
				console.warn( `Unable to download guild icon of ${guild.name}.`, `Caught (in promise)\n`, e );
				this.addMember( this.dataNames.guild, { id: guild.id, image: null } );
			});
		} catch ( e ) {
			console.warn( `Unable to download guild icon of ${guild.name}.`, `Caught\n`, e );
			this.addMember( this.dataNames.guild, { id: guild.id, image: null } );
		}
	}
	
	createUser( id ) {
		let user = this.module( this.modules.getUser, id );
		if ( user == undefined ) throw 'Undefined User';
		this.addMember( this.dataNames.user, { id: user.id, username: user.username, discriminator: user.discriminator } );
		
		try {
			let url = user.getAvatarURL( 'png' );
			if ( url == undefined )
				throw 'Undefined Icon';
			let ext = path.extname( url );
			ext = ext.slice( 0, ext.indexOf( '?' ) );
			this.downloadImage( url, path.format({ dir: path.join( this.dir, this.dataNames.user ), name: user.id, ext: ext }) ).then((result) => {
				this.addMember( this.dataNames.user, { id: user.id, image: path.format({ name: user.id, ext: ext }) } );
			}).catch((e)=>{
				console.warn( `Unable to download user icon of ${user.username}#${user.discriminator}.`, `Caught (in promise)\n`, e );
				this.addMember( this.dataNames.user, { id: user.id, image: [url] } );
			});
		} catch ( e ) {
			console.warn( `Unable to download user icon of ${user.username}#${user.discriminator}.`, `Caught (in promise)\n`, e );
			this.addMember( this.dataNames.user, { id: user.id, image: [url] } );
		}
	}
	
	get dataNames() {
		return {
			guild: 'guild',
			user: 'user',
		}
	}
	
	addMember( type, member ) {
		let log = this.getLog( type );
		log[ member.id ] = { ...log[ member.id ], ...member };
		this.setLog( type, log );
	}
	
	removeMember( type, member ) {
		let log = this.getLog( type );
		delete log[ member.id ];
		this.setLog( type, log );
	}
	
	setLog( log, o ) {
		this.writeData( this.dataNames[ log ], o );
	}
	
	getLog( log ) {
		return this.readData( this.dataNames[ log ], {} );
	}
	
	/*
	 * Writes to the plugin data.
	 */
	writeData( key, data ) {
		BdApi.saveData( this.getShortName(), key, data );
	}

	/*
	 * Reads from the plugin data.
	 */
	readData( key, fallback ) {
		let value = BdApi.loadData( this.getShortName(), key );
		return typeof value !== 'undefined' ? value : fallback;
	}
}
