// Copyright (c) 2020 Jarret Dyrbye
// Distributed under the MIT software license, see the accompanying
// file LICENSE or http://www.opensource.org/licenses/mit-license.php

const moneysocket = require('moneysocket');
const WebsocketLocation = moneysocket.WebsocketLocation;
const OutgoingWebsocketLayer = moneysocket.OutgoingWebsocketLayer;
const OutgoingRendezvousLayer = moneysocket.OutgoingRendezvousLayer;
const ConsumerLayer = moneysocket.ConsumerLayer;
const ConsumerTransactLayer = moneysocket.ConsumerTransactLayer;
const BuyerLayer = require("../buyer/layer.js").BuyerLayer;

class BuyerStack {
    constructor(app) {
        this.app = app;

        this.onannounce = null;
        this.onrevoke = null;
        this.onproviderinfo = null;
        this.onstackevent = null;
        this.onping = null;
        this.oninvoice = null;
        this.onpreimage = null;
        this.onsellerinfo = null;
        this.onopinioninvoice = null;
        this.onopinion = null;

        this.websocket_layer = this.setupOutgoingWebsocketLayer();
        this.rendezvous_layer = this.setupOutgoingRendezvousLayer(
            this.websocket_layer);
        this.consumer_layer = this.setupConsumerLayer(this.rendezvous_layer);
        this.transact_layer = this.setupConsumerTransactLayer(
            this.consumer_layer);
        this.buyer_layer = this.setupBuyerLayer(this.transact_layer);


        this.buyer_layer.onannounce = (function(nexus) {
            this.announceNexus(nexus);
        }).bind(this);
        this.buyer_layer.onrevoke = (function(nexus) {
            this.revokeNexus(nexus);
        }).bind(this);

    }

    //////////////////////////////////////////////////////////////////////////
    // setup
    //////////////////////////////////////////////////////////////////////////

    setupBuyerLayer(below_layer) {
        var l = new BuyerLayer();
        l.onlayerevent = (function(nexus, status) {
            this.onLayerEvent("BUYER", nexus, status);
        }).bind(this);
        l.onsellerinfo = (function(nexus, seller_info) {
            this.onSellerInfo(nexus, seller_info);
        }).bind(this);
        l.onopinioninvoice = (function(nexus, bolt11, request_reference_uuid) {
            this.onOpinionInvoice(nexus, bolt11, request_reference_uuid);
        }).bind(this);
        l.onopinion = (function(nexus, item_id, opinion) {
            this.onOpinion(nexus, item_id, opinion);
        }).bind(this);
        l.registerAboveLayer(below_layer);
        return l;
    }

    setupConsumerTransactLayer(below_layer) {
        var l = new ConsumerTransactLayer();
        l.onlayerevent = (function(nexus, status) {
            this.onLayerEvent("CONSUMER_TRANSACT", nexus, status);
        }).bind(this);
        l.oninvoice = (function(nexus, bolt11, request_reference_uuid) {
            this.onInvoice(nexus, bolt11, request_reference_uuid);
        }).bind(this);
        l.onpreimage = (function(nexus, preimage, request_reference_uuid) {
            this.onPreimage(nexus, preimage, request_reference_uuid);
        }).bind(this);
        l.registerAboveLayer(below_layer);
        return l;
    }

    setupConsumerLayer(below_layer) {
        var l = new ConsumerLayer();
        l.onlayerevent = (function(nexus, status) {
            this.onLayerEvent("CONSUMER", nexus, status);
        }).bind(this);
        l.onproviderinfo = (function(nexus, msg) {
            this.onProviderInfo(nexus, msg);
        }).bind(this);
        l.onping = (function(nexus, msecs) {
            this.onPing(nexus, msecs);
        }).bind(this);
        l.registerAboveLayer(below_layer);
        return l;
    }

    setupOutgoingRendezvousLayer(below_layer) {
        var l = new OutgoingRendezvousLayer();
        l.onlayerevent = (function(nexus, status) {
            this.onLayerEvent("OUTGOING_RENDEZVOUS", nexus, status);
        }).bind(this);
        l.registerAboveLayer(below_layer);
        return l;
    }

    setupOutgoingWebsocketLayer() {
        var l = new OutgoingWebsocketLayer();
        l.onlayerevent = (function(nexus, status) {
            this.onLayerEvent("OUTGOING_WEBSOCKET", nexus, status);
        }).bind(this);
        return l;
    }

    //////////////////////////////////////////////////////////////////////////
    // buyer layer callbacks:
    //////////////////////////////////////////////////////////////////////////

    onOpinionInvoice(buyer_nexus, bolt11, request_reference_uuid) {
        if (this.onopinioninvoice != null) {
            this.onopinioninvoice(bolt11, request_reference_uuid);
        }
    }

    onOpinion(buyer_nexus, item_id, opinion) {
        if (this.onopinion != null) {
            this.onopinion(item_id, opinion);
        }
    }

    onSellerInfo(buyer_nexus, seller_info) {
        if (this.onsellerinfo != null) {
            this.onsellerinfo(seller_info);
        }
    }

    //////////////////////////////////////////////////////////////////////////
    // transact layer callbacks:
    //////////////////////////////////////////////////////////////////////////

    onInvoice(transact_nexus, bolt11, request_reference_uuid) {
        if (this.oninvoice != null) {
            this.oninvoice(bolt11, request_reference_uuid);
        }
    }

    onPreimage(transact_nexus, preimage, request_reference_uuid) {
        if (this.onpreimage != null) {
            this.onpreimage(preimage, request_reference_uuid);
        }
    }

    //////////////////////////////////////////////////////////////////////////
    // consumer layer callbacks:
    //////////////////////////////////////////////////////////////////////////

    onProviderInfo(consumer_nexus, msg) {
        var provider_info = {'payer':         msg['payer'],
                             'payee':         msg['payee'],
                             'msats':         msg['msats'],
                             'provider_uuid': msg['provider_uuid']};
        if (this.onproviderinfo != null) {
            this.onproviderinfo(provider_info);
        }
    }

    onPing(consumer_nexus, msecs) {
        if (this.onping != null) {
        this.onping(msecs);
        }
    }

    //////////////////////////////////////////////////////////////////////////
    // layer callbacks:
    //////////////////////////////////////////////////////////////////////////

    announceNexus(buyer_nexus) {
        this.nexus = buyer_nexus;
        this.shared_seed = buyer_nexus.getSharedSeed();

        console.log("got buyer nexus");
        if (this.onannounce != null) {
            console.log("announce buyer nexus");
            this.onannounce(buyer_nexus);
        }
    }

    revokeNexus(buyer_nexus) {
        this.nexus = null;
        this.shared_seed = null;
        console.log("lost buyer nexus");
        if (this.onrevoke != null) {
            this.onrevoke(buyer_nexus);
        }
    }

    onLayerEvent(layer_name, nexus, status) {
        if (this.onstackevent != null) {
            this.onstackevent(layer_name, nexus, status);
        }
    }

    //////////////////////////////////////////////////////////////////////////
    // UI calls these
    //////////////////////////////////////////////////////////////////////////

    doConnect(beacon) {
        console.log("buyer stack connect called");

        var location = beacon.locations[0];
        var shared_seed = beacon.getSharedSeed();
        if (! (location instanceof WebsocketLocation)) {
            console.error("not websocket location?");
            return;
        }
        console.log("connect buyer: " + location.toWsUrl());
        this.websocket_layer.connect(location, shared_seed)
    }

    doDisconnect() {
        console.log("buyer stack disconnect called");
        this.websocket_layer.initiateCloseAll();
    }

    buyItem(item_id) {
        this.nexus.requestOpinionInvoice(item_id);
    }

}


exports.BuyerStack = BuyerStack;
