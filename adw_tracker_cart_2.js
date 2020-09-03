(async () => {
	let this_script = document.getElementById('advocate-tracker');
	const domain_api = this_script.dataset.is_staging ? 'staging-api.advocate.wine' : 'api.advocate.wine';
	const tenant = this_script.dataset.advocate_tenant;

	// set up cookie model
	let cookie_context = {
		adw_hidesrc: undefined,
		adw_product: undefined,
		adw_promo: undefined,
		adw_referer_id: undefined,
		sku: undefined,
		adw_processed_cart: undefined
	};

	let set_cookie = function(cookie_name, cookie_value, cookie_duration, cookie_context) {
		let expiry_date = new Date(new Date().getTime() + (1000 * 60 * 60 * 24 * cookie_duration));
		let expires_text = "expires=" + expiry_date.toUTCString();
		document.cookie = cookie_name + "=" + cookie_value + ";" + expires_text + ";path=/";
		cookie_context[cookie_name] = cookie_duration > 0 ? cookie_value : undefined;
	}

	let get_cookie = function(cookie_name) {
		let name = cookie_name + "=";
		let decoded_cookie = decodeURIComponent(document.cookie);
		let cookie_fragments = decoded_cookie.split(';');
		for (let i = 0; i < cookie_fragments.length; i++) {
			let raw_cookie = cookie_fragments[i].trim();
			if (raw_cookie.includes(name)) {
				return raw_cookie.substring(name.length, raw_cookie.length);
			}
		}
		return undefined;
	}

	// populate cookie model
	for (let key of Object.keys(cookie_context)) {
		cookie_context[key] = get_cookie(key);
	}

	//handle the query parameter caching
	const url_parameters = new URLSearchParams(window.location.search);
	let query_adw_hidesrc = url_parameters.get('advocate_hidesource');
	let query_adw_product = url_parameters.get('advocate_product_id');
	let query_adw_promo = url_parameters.get('advocate_promo');
	let query_referer_id = url_parameters.get('advocate_id');
	let query_sku = url_parameters.get('sku');
	let query_order_id = url_parameters.get('orderID');

	if (query_adw_hidesrc) { set_cookie('adw_hidesrc', query_adw_hidesrc, 1, cookie_context) }
	if (query_adw_product) { set_cookie('adw_product', query_adw_product, 1, cookie_context) }
	if (query_adw_promo) { set_cookie('adw_promo', query_adw_promo, 1, cookie_context) }
	if (query_referer_id) { set_cookie('adw_referer_id', query_referer_id, 1, cookie_context) }
	if (query_sku) { set_cookie('sku', query_sku, 1, cookie_context) }
	
	//redirect, if necessary
	if (query_adw_product) {
		window.location.href = `./index.cfm?method=products.ProductDrilldown&productid=${query_adw_product}`;
	}

	//set up use of the advocate.wine coupon
	if (cookie_context.adw_promo && cookie_context.sku) {
		const form_data = new FormData();
		form_data.append('productSKU', cookie_context.sku);
		form_data.append('Quantity', 1);

		if (!cookie_context.adw_processed_cart) {
			set_cookie('adw_processed_cart', true, .1, cookie_context);
			let result_cart = await ky.post(`https://${window.location.hostname}/index.cfm?method=cartV2.addToCart`, {
				body: form_data
			});
		}

		if (cookie_context.adw_processed_cart) {
			vin65.cart.showCart();
			let result_coupon = await ky.get(`https://${window.location.hostname}/index.cfm?method=checkoutV2.addCouponToCartJSON&referrer=showCart&couponCode=${cookie_context.adw_promo}`);

		}
	}

	// if we're on the recipt page, which has an order in the query string, send the referral to advocate.wine.
	if (query_order_id && cookie_context.adw_referer_id) {
		let result = await ky.post(`https://${domain_api}/orders/winery/${tenant}/order/${query_order_id}/user/${cookie_context.adw_referer_id}`, {
			headers: {
				'Access-Control-Allow-Origin': domain_api,
			},
			json: {
				userId: cookie_context.adw_referer_id,
				wineId: cookie_context.adw_product,
				OrderId: query_order_id
			}
		});

		//if we successfully made an attribution, reset all the referral datas
		if (result.ok) {
			set_cookie('adw_hidesrc', '', -1, cookie_context);
			set_cookie('adw_product', '', -1, cookie_context);
			set_cookie('adw_promo', '', -1, cookie_context);
			set_cookie('adw_referer_id', '', -1, cookie_context);
			set_cookie('sku', '', -1, cookie_context);
			set_cookie('adw_processed_cart', '', -1, cookie_context);
        }
    }
})();
