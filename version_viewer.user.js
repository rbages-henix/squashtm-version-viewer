// ==UserScript==
// @name         Squash TM - Dynamic Env & Version Badge (Nightly & Snapshot Sync)
// @namespace    http://tampermonkey.net/
// @version      9.0
// @description  Badge complet : Affichage double date (Snapshot + Nightly Docker), Drag & Drop et Auth Nexus.
// @author       QA Tester
// @match        *://rec-squashtm-*/*
// @match        *://*.squashtest.org/*
// @match        *://*/*squash*
// @noframes
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @connect      nexus.squashtest.org
// ==/UserScript==

(async function() {
    'use strict';

    if (window.self !== window.top) return;

    // ==============================================================================
    // GESTION SÉCURISÉE DES IDENTIFIANTS NEXUS
    // ==============================================================================
    function showCredentialsModal() {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            Object.assign(overlay.style, {
                position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
                backgroundColor: 'rgba(0,0,0,0.5)', zIndex: '1000000',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
            });

            const box = document.createElement('div');
            Object.assign(box.style, {
                backgroundColor: '#ffffff', padding: '24px', borderRadius: '8px',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                width: '320px', fontFamily: 'Arial, sans-serif', color: '#333'
            });

            box.innerHTML = `
                <h3 style="margin: 0 0 16px 0; font-size: 18px; color: #111;">⚙️ Configuration Nexus</h3>
                <label style="display: block; margin-bottom: 6px; font-size: 13px; font-weight: bold;">Nom d'utilisateur :</label>
                <input type="text" id="nexus-user-input" placeholder="ex: rbages" style="width: 100%; padding: 8px 12px; margin-bottom: 16px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; font-size: 14px;">
                <label style="display: block; margin-bottom: 6px; font-size: 13px; font-weight: bold;">Mot de passe :</label>
                <input type="password" id="nexus-pass-input" placeholder="••••••••" style="width: 100%; padding: 8px 12px; margin-bottom: 24px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; font-size: 14px;">
                <div style="display: flex; justify-content: flex-end; gap: 12px;">
                    <button id="nexus-btn-cancel" style="padding: 8px 16px; border: none; background: #e5e7eb; color: #374151; border-radius: 4px; cursor: pointer; font-weight: bold; transition: background 0.2s;">Annuler</button>
                    <button id="nexus-btn-save" style="padding: 8px 16px; border: none; background: #3B82F6; color: white; border-radius: 4px; cursor: pointer; font-weight: bold; transition: background 0.2s;">Enregistrer</button>
                </div>
            `;

            overlay.appendChild(box);
            document.body.appendChild(overlay);
            document.getElementById('nexus-user-input').focus();

            const cleanup = () => document.body.removeChild(overlay);

            document.getElementById('nexus-btn-cancel').onclick = () => { cleanup(); resolve(null); };
            document.getElementById('nexus-btn-save').onclick = () => {
                const u = document.getElementById('nexus-user-input').value.trim();
                const p = document.getElementById('nexus-pass-input').value.trim();
                cleanup();
                if (u && p) resolve({ user: u, pass: p });
                else resolve(null);
            };
        });
    }

    GM_registerMenuCommand("⚙️ Configurer identifiants Nexus", async () => {
        const creds = await showCredentialsModal();
        if (creds) {
            try {
                const encoded = btoa(unescape(encodeURIComponent(creds.user + ":" + creds.pass)));
                GM_setValue("nexus_secure_auth", encoded);
                alert("✅ Identifiants sauvegardés en toute sécurité dans Tampermonkey !");
                location.reload(); 
            } catch (e) {
                alert("❌ Erreur lors de la sauvegarde.");
            }
        }
    });

    GM_registerMenuCommand("🗑️ Effacer identifiants Nexus", () => {
        if(confirm("Voulez-vous vraiment supprimer vos identifiants enregistrés ?")) {
            GM_setValue("nexus_secure_auth", null);
            alert("🗑️ Identifiants effacés !");
            location.reload();
        }
    });

    GM_registerMenuCommand("🔄 Réinitialiser la position de l'étiquette", () => {
        localStorage.removeItem('squash-badge-position');
        isCollapsed = false;
        localStorage.setItem('squash-badge-collapsed', false);
        if (badgeElement) {
            updateBadgeAppearance();
        }
    });
    // ==============================================================================

    let exactVersion = null;
    let validApiUrl = null; 
    let badgeElement = null;
    
    // États pour l'API Nexus 
    let nexusStatus = "IDLE"; 
    let snapshotDate = null;
    let nightlyDate = null;

    const apiEndpoints =[
        window.location.origin + '/squash/backend/version',            
        window.location.origin + '/backend/version',                   
        window.location.origin + '/squash/backend/information/version',
        window.location.origin + '/backend/information/version'         
    ];

    // 1. DÉTECTION DE L'ENVIRONNEMENT
    const hostname = window.location.hostname;
    let envName = "INCONNU";
    let envColor = "#6B7280"; 

    if (hostname.includes('rec-squashtm-')) {
        envName = "RECETTE";
        envColor = "#10B981"; 
    } else if (hostname === 'recette.squashtest.org') {
        envName = "PROD"; 
        envColor = "#EF4444"; 
    } else if (hostname.includes('nightly') || hostname.includes('acceptance')) {
        envName = "NIGHTLY"; 
        envColor = "#8B5CF6"; 
    } else {
        envName = "SQUASH TM";
        envColor = "#3B82F6"; 
    }

    // 2. REQUÊTES VERS L'API NEXUS (Snapshot + Docker Nightly)
    function getAuthHeaders() {
        let requestHeaders = { "Accept": "application/json", "X-Requested-With": "XMLHttpRequest" };
        let useCookies = true;

        const secureAuth = GM_getValue("nexus_secure_auth", null);
        if (secureAuth) {
            requestHeaders["Authorization"] = "Basic " + secureAuth;
            useCookies = false; 
        }
        return { headers: requestHeaders, withCredentials: useCookies };
    }

    // Récupération de la date de la snapshot Maven (.zip)
    function fetchSnapshotDate(version) {
        return new Promise((resolve) => {
            const searchUrl = `https://nexus.squashtest.org/nexus/service/rest/v1/search/assets?repository=private-snapshots&q=squash-tm-${version}.zip`;
            const auth = getAuthHeaders();

            GM_xmlhttpRequest({
                method: "GET", url: searchUrl, headers: auth.headers, withCredentials: auth.withCredentials, timeout: 5000,
                onload: function(response) {
                    if (response.status === 401 || response.status === 403) return resolve("UNAUTHORIZED");
                    if (response.status === 200) {
                        try {
                            const data = JSON.parse(response.responseText);
                            if (data.items && data.items.length > 0) {
                                const zipAsset = data.items.find(item => item.path.endsWith(`${version}.zip`));
                                const dateVal = zipAsset ? (zipAsset.lastModified || zipAsset.blobCreated || zipAsset.blobUpdated) : null;
                                if (dateVal) {
                                    const d = new Date(dateVal);
                                    return resolve(d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }));
                                }
                            }
                        } catch (e) {}
                    }
                    resolve("ERROR");
                },
                onerror: function() { resolve("ERROR"); },
                ontimeout: function() { resolve("ERROR"); }
            });
        });
    }

    // Récupération de la date de l'image Docker de la Nightly
    function fetchNightlyDate() {
        return new Promise((resolve) => {
            const searchUrl = `https://nexus.squashtest.org/nexus/service/rest/v1/search/assets?repository=docker-group&docker.imageName=squash&docker.imageTag=nightly`;
            const auth = getAuthHeaders();

            GM_xmlhttpRequest({
                method: "GET", url: searchUrl, headers: auth.headers, withCredentials: auth.withCredentials, timeout: 5000,
                onload: function(response) {
                    if (response.status === 401 || response.status === 403) return resolve("UNAUTHORIZED");
                    if (response.status === 200) {
                        try {
                            const data = JSON.parse(response.responseText);
                            if (data.items && data.items.length > 0) {
                                const tagAsset = data.items.find(item => item.path && item.path.includes('nightly')) || data.items[0];
                                const dateVal = tagAsset ? (tagAsset.lastModified || tagAsset.blobCreated || tagAsset.blobUpdated) : null;
                                if (dateVal) {
                                    const d = new Date(dateVal);
                                    return resolve(d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }));
                                }
                            }
                        } catch (e) {}
                    }
                    
                    // Fallback de recherche générique au cas où
                    const fallbackUrl = `https://nexus.squashtest.org/nexus/service/rest/v1/search/assets?repository=docker-group&q=nightly`;
                    GM_xmlhttpRequest({
                        method: "GET", url: fallbackUrl, headers: auth.headers, withCredentials: auth.withCredentials, timeout: 5000,
                        onload: function(fallbackResp) {
                            if (fallbackResp.status === 401 || fallbackResp.status === 403) return resolve("UNAUTHORIZED");
                            if (fallbackResp.status === 200) {
                                try {
                                    const fbData = JSON.parse(fallbackResp.responseText);
                                    if (fbData.items && fbData.items.length > 0) {
                                        const tagAsset = fbData.items.find(item => item.path && item.path.includes('v2/squash')) || fbData.items[0];
                                        const dateVal = tagAsset ? (tagAsset.lastModified || tagAsset.blobCreated || tagAsset.blobUpdated) : null;
                                        if (dateVal) {
                                            const d = new Date(dateVal);
                                            return resolve(d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }));
                                        }
                                    }
                                } catch (e) {}
                            }
                            resolve("ERROR");
                        },
                        onerror: function() { resolve("ERROR"); },
                        ontimeout: function() { resolve("ERROR"); }
                    });
                },
                onerror: function() { resolve("ERROR"); },
                ontimeout: function() { resolve("ERROR"); }
            });
        });
    }

    async function checkNexus() {
        const isSnapshot = exactVersion && exactVersion.includes('SNAPSHOT');
        const isNightly = envName === "NIGHTLY";

        if ((!isSnapshot && !isNightly) || nexusStatus !== "IDLE") return;
        
        nexusStatus = "LOADING";
        updateBadgeAppearance(); 
        
        const promises =[];
        if (isSnapshot) {
            const rawVersion = exactVersion.replace('v', '');
            promises.push(fetchSnapshotDate(rawVersion).then(res => ({ type: 'snapshot', res })));
        }
        if (isNightly) {
            promises.push(fetchNightlyDate().then(res => ({ type: 'nightly', res })));
        }

        const results = await Promise.all(promises);

        let hasUnauthorized = false;
        let hasError = false;

        for (const item of results) {
            if (item.res === "UNAUTHORIZED") hasUnauthorized = true;
            else if (item.res === "ERROR" || !item.res) hasError = true;
            else {
                if (item.type === 'snapshot') snapshotDate = item.res;
                if (item.type === 'nightly') nightlyDate = item.res;
            }
        }

        if (hasUnauthorized) nexusStatus = "UNAUTHORIZED";
        else if (hasError && !snapshotDate && !nightlyDate) nexusStatus = "ERROR";
        else nexusStatus = "SUCCESS";
        
        updateBadgeAppearance(); 
    }

    // 3. FONCTION DE RÉCUPÉRATION SQUASH
    async function fetchVersionData() {
        const urlsToTest = validApiUrl ? [validApiUrl] : apiEndpoints;
        let requiresAuth = false;

        for (const apiUrl of urlsToTest) {
            try {
                const response = await fetch(apiUrl);
                if (response.ok) {
                    const data = await response.json();
                    if (data && data.version) {
                        validApiUrl = apiUrl; 
                        return { status: 200, version: `v${data.version}` };
                    }
                } else if (response.status === 401) requiresAuth = true;
            } catch (error) {}
        }
        if (requiresAuth) return { status: 401, version: "Non connecté" };
        return { status: 0, version: null };
    }

    // 4. FONCTIONS VISUELLES ET DRAG & DROP
    let isCollapsed = localStorage.getItem('squash-badge-collapsed') === 'true';
    let isDragging = false;
    let hasMoved = false;
    let dragStartX, dragStartY;
    let badgeStartLeft, badgeStartTop;

    function applyPosition() {
        if (!badgeElement) return;
        let savedPos = JSON.parse(localStorage.getItem('squash-badge-position'));
        
        if (savedPos) {
            badgeElement.style.left = savedPos.left;
            badgeElement.style.top = savedPos.top;
            badgeElement.style.bottom = 'auto';
            badgeElement.style.right = 'auto';
        } else {
            badgeElement.style.left = 'auto';
            badgeElement.style.top = 'auto';
            if (isCollapsed) {
                badgeElement.style.bottom = '10px';
                badgeElement.style.right = '10px';
            } else {
                badgeElement.style.bottom = '20px';
                badgeElement.style.right = '20px';
            }
        }
    }

    function updateBadgeAppearance() {
        if (!badgeElement) return;

        if (isCollapsed) {
            badgeElement.innerHTML = `<strong>${envName.charAt(0)}</strong>`;
            badgeElement.style.padding = '0';
            badgeElement.style.width = '28px';
            badgeElement.style.height = '28px';
            badgeElement.style.borderRadius = '50%';
            badgeElement.style.opacity = '0.4';
            badgeElement.style.flexDirection = 'row';
        } else {
            let text = `<div style="display:flex; align-items:center;"><strong>${envName}</strong> &nbsp;|&nbsp; ${exactVersion}</div>`;
            
            const isSnapshot = exactVersion && exactVersion.includes('SNAPSHOT');
            const isNightly = envName === "NIGHTLY";

            if (isSnapshot || isNightly) {
                if (nexusStatus === "LOADING") {
                    text += `<div style="font-size: 11px; opacity: 0.7; font-weight: normal; margin-top: 4px; text-align: center;">MAJ : Recherche...</div>`;
                } else if (nexusStatus === "UNAUTHORIZED") {
                    const hasSavedCreds = GM_getValue("nexus_secure_auth", null) !== null;
                    const errorMsg = hasSavedCreds ? "⚠️ Identifiants Nexus invalides" : "⚠️ Identifiants Nexus manquants";
                    text += `<div style="font-size: 11px; opacity: 0.9; font-weight: normal; color: #fca5a5; margin-top: 4px; text-align: center;" title="Utilisez le menu Tampermonkey pour les configurer">${errorMsg}</div>`;
                } else if (nexusStatus === "ERROR" && !snapshotDate && !nightlyDate) {
                    text += `<div style="font-size: 11px; opacity: 0.9; font-weight: normal; color: #fca5a5; margin-top: 4px; text-align: center;">⚠️ Erreur de connexion au Nexus</div>`;
                } else {
                    let datesHtml = '';
                    if (isNightly && nightlyDate) {
                        datesHtml += `<div><strong>Nightly :</strong> ${nightlyDate}</div>`;
                    }
                    if (isSnapshot && snapshotDate) {
                        datesHtml += `<div><strong>Snapshot :</strong> ${snapshotDate}</div>`;
                    } else if (!isNightly && snapshotDate) {
                        datesHtml += `<div><strong>MAJ :</strong> ${snapshotDate}</div>`;
                    }

                    if (datesHtml) {
                        text += `<div style="font-size: 10.5px; opacity: 0.95; font-weight: normal; margin-top: 4px; text-align: left; line-height: 1.35;">${datesHtml}</div>`;
                    }
                }
            }
            
            badgeElement.innerHTML = text;
            badgeElement.style.padding = '8px 14px';
            badgeElement.style.width = 'auto';
            badgeElement.style.height = 'auto';
            badgeElement.style.borderRadius = '6px';
            badgeElement.style.opacity = '1';
            badgeElement.style.flexDirection = 'column';
        }
        applyPosition();
    }

    function createBadge() {
        if (document.getElementById('qa-squash-dynamic-badge')) {
            badgeElement = document.getElementById('qa-squash-dynamic-badge');
            return;
        }

        badgeElement = document.createElement('div');
        badgeElement.id = 'qa-squash-dynamic-badge';
        badgeElement.title = "Cliquez pour réduire, glissez pour déplacer";
        
        Object.assign(badgeElement.style, {
            position: 'fixed',
            backgroundColor: envColor,
            color: '#FFFFFF',
            fontFamily: 'Arial, sans-serif',
            fontSize: '13px',
            zIndex: '999999',
            boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
            cursor: 'grab',
            transition: 'opacity 0.2s ease-in-out', 
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            userSelect: 'none' 
        });

        // Logique Drag & Drop
        badgeElement.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return; 
            isDragging = true;
            hasMoved = false;
            dragStartX = e.clientX;
            dragStartY = e.clientY;

            const rect = badgeElement.getBoundingClientRect();
            badgeStartLeft = rect.left;
            badgeStartTop = rect.top;

            badgeElement.style.cursor = 'grabbing';
            e.preventDefault(); 
        });

        window.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            const dx = e.clientX - dragStartX;
            const dy = e.clientY - dragStartY;

            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
                hasMoved = true;
            }

            if (hasMoved) {
                let newLeft = badgeStartLeft + dx;
                let newTop = badgeStartTop + dy;
                
                const maxLeft = window.innerWidth - badgeElement.offsetWidth;
                const maxTop = window.innerHeight - badgeElement.offsetHeight;
                newLeft = Math.max(0, Math.min(newLeft, maxLeft));
                newTop = Math.max(0, Math.min(newTop, maxTop));

                badgeElement.style.left = newLeft + 'px';
                badgeElement.style.top = newTop + 'px';
                badgeElement.style.bottom = 'auto';
                badgeElement.style.right = 'auto';
            }
        });

        window.addEventListener('mouseup', () => {
            if (!isDragging) return;
            isDragging = false;
            badgeElement.style.cursor = 'grab';

            if (hasMoved) {
                localStorage.setItem('squash-badge-position', JSON.stringify({
                    left: badgeElement.style.left,
                    top: badgeElement.style.top
                }));
            }
        });

        badgeElement.addEventListener('click', (e) => {
            if (hasMoved) {
                e.stopPropagation();
                return; 
            }
            isCollapsed = !isCollapsed;
            localStorage.setItem('squash-badge-collapsed', isCollapsed);
            updateBadgeAppearance();
        });

        badgeElement.addEventListener('mouseenter', () => { if (isCollapsed && !isDragging) badgeElement.style.opacity = '1'; });
        badgeElement.addEventListener('mouseleave', () => { if (isCollapsed && !isDragging) badgeElement.style.opacity = '0.4'; });

        document.body.appendChild(badgeElement);
        updateBadgeAppearance();
    }

    // 5. LOGIQUE PRINCIPALE 
    const result = await fetchVersionData();
    if (result.status === 0) return; 
    exactVersion = result.version;
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => { createBadge(); checkNexus(); });
    } else {
        createBadge(); checkNexus();
    }

    if (result.status === 401) {
        const pollingInterval = setInterval(async () => {
            const pollResult = await fetchVersionData();
            if (pollResult.status === 200) {
                exactVersion = pollResult.version;
                updateBadgeAppearance(); 
                clearInterval(pollingInterval); 
                checkNexus(); 
            }
        }, 3000); 
    }

})();