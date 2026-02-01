(() => {
  const formatPrice = (price, currency, locale) => {
    if (!price) {
      return "";
    }

    const numericPrice = Number.parseFloat(price);

    if (Number.isNaN(numericPrice)) {
      return price;
    }

    const currencyCode =
      currency || window.Shopify?.currency?.active || "USD";
    const localeCode = locale || document.documentElement.lang || undefined;

    try {
      return new Intl.NumberFormat(localeCode, {
        style: "currency",
        currency: currencyCode,
      }).format(numericPrice);
    } catch (error) {
      console.warn("Unable to format price", error);
      return `${numericPrice.toFixed(2)} ${currencyCode || ""}`.trim();
    }
  };

  const setHiddenValue = (form, selector, value) => {
    const input = form.querySelector(selector);
    if (input) {
      input.value = value ?? "";
    }
  };

  const TYPE_PARAM = "type";
  const REQUEST_TYPE_MAP = {
    visual: "visual_enquiry",
    quote: "quote",
    sample: "sample",
    buy: "buy",
  };

  const getTitleTemplates = (section) => {
    const script = section?.querySelector("[data-title-templates]");
    if (!script) return null;
    try {
      return JSON.parse(script.textContent);
    } catch (e) {
      return null;
    }
  };

  const getDynamicTitleText = (type, productTitle, templates) => {
    if (!type || !templates) return null;
    const key = productTitle
      ? `${type}_with_product`
      : type;
    const template = templates[key] ?? templates[type];
    if (!template) return null;
    return template.replace(/\{\{\s*product_title\s*\}\}/g, productTitle || "");
  };

  const updateDynamicHeading = (section, productTitle) => {
    if (!section) return;
    const params = new URLSearchParams(window.location.search);
    const type = params.get(TYPE_PARAM);
    if (!type) return;
    const templates = getTitleTemplates(section);
    const text = getDynamicTitleText(type, productTitle, templates);
    if (text == null) return;
    const heading = section.querySelector("[data-dynamic-heading]");
    if (heading) heading.textContent = text;
    const requestType = REQUEST_TYPE_MAP[type];
    if (requestType) {
      const input = section.querySelector("[data-request-type-input]");
      if (input) input.value = requestType;
    }
  };

  const applyProductToUI = ({
    form,
    contextNode,
    product,
    currency,
    locale,
  }) => {
    const card = contextNode.querySelector("[data-product-card]");
    const emptyState = contextNode.querySelector("[data-product-empty]");

    if (!card) {
      return;
    }

    const titleNode = card.querySelector("[data-product-title]");
    const priceNode = card.querySelector("[data-product-price]");
    const imageNode = card.querySelector("[data-product-image]");
    const linkNode = card.querySelector("[data-product-url]");

    const variant = product?.variants?.[0];
    const handle = product?.handle;
    const productUrl =
      product?.url ||
      (handle
        ? `${window.Shopify?.routes?.root || "/"}products/${handle}`
        : "");

    if (titleNode) {
      titleNode.textContent = product?.title || "";
    }

    if (priceNode) {
      priceNode.textContent = formatPrice(variant?.price, currency, locale);
    }

    if (linkNode) {
      if (productUrl) {
        linkNode.href = productUrl;
        linkNode.removeAttribute("aria-disabled");
      } else {
        linkNode.href = "#";
        linkNode.setAttribute("aria-disabled", "true");
      }
    }

    if (imageNode) {
      const featuredImage = product?.featured_image;
      const primaryImage =
        typeof featuredImage === "string"
          ? featuredImage
          : featuredImage?.src ||
            product?.images?.[0] ||
            product?.media?.[0]?.src;

      if (primaryImage) {
        imageNode.src = primaryImage;
        imageNode.hidden = false;
      } else {
        imageNode.hidden = true;
        imageNode.removeAttribute("src");
      }
    }

    card.hidden = false;
    if (emptyState) {
      emptyState.hidden = true;
    }

    if (form) {
      setHiddenValue(form, "[data-product-id-input]", product?.id);
      setHiddenValue(form, "[data-product-handle-input]", handle);
      setHiddenValue(form, "[data-product-title-input]", product?.title);
      setHiddenValue(form, "[data-product-url-input]", productUrl);
    }
    const section = form?.closest(".custom-enquiry");
    if (section) updateDynamicHeading(section, product?.title || "");
  };

  const showEmptyState = (contextNode) => {
    const card = contextNode.querySelector("[data-product-card]");
    const emptyState = contextNode.querySelector("[data-product-empty]");

    if (card) {
      card.hidden = true;
    }

    if (emptyState) {
      emptyState.hidden = false;
    }
  };

  const readPreviewProduct = (contextNode) => {
    const previewNode = contextNode.querySelector("[data-preview-product]");
    if (!previewNode) {
      return null;
    }

    try {
      return JSON.parse(previewNode.textContent);
    } catch (error) {
      console.warn("Failed to parse preview product JSON", error);
      return null;
    }
  };

  const fetchProductByHandle = async (handle) => {
    if (!handle) {
      return null;
    }

    const rootPath = window.Shopify?.routes?.root || "/";
    const normalizedRoot = rootPath.endsWith("/")
      ? rootPath.slice(0, -1)
      : rootPath;
    const response = await fetch(`${normalizedRoot}/products/${handle}.js`, {
      credentials: "same-origin",
    });

    if (!response.ok) {
      throw new Error(`Unable to load product "${handle}"`);
    }

    return response.json();
  };

  const initProductContext = (form) => {
    const container = form.closest("[data-product-context-wrapper]");

    if (!container) {
      return;
    }

    const contextNode = container.querySelector("[data-product-context]");

    if (!contextNode) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const handleParam =
      contextNode.dataset.productHandleParam || "product_handle";
    const productHandle = params.get(handleParam);
    const currency = contextNode.dataset.shopCurrency;
    const locale = contextNode.dataset.locale;
    const previewProduct = readPreviewProduct(contextNode);

    if (productHandle) {
      fetchProductByHandle(productHandle)
        .then((product) => {
          applyProductToUI({
            form,
            contextNode,
            product,
            currency,
            locale,
          });
        })
        .catch((error) => {
          console.warn("Failed to load product context", error);
          if (previewProduct) {
            applyProductToUI({
              form,
              contextNode,
              product: previewProduct,
              currency,
              locale,
            });
            return;
          }
          showEmptyState(contextNode);
        });
      return;
    }

    if (previewProduct) {
      applyProductToUI({
        form,
        contextNode,
        product: previewProduct,
        currency,
        locale,
      });
      return;
    }

    showEmptyState(contextNode);
  };

  const initForm = (form) => {
    if (window.Shopify && window.Shopify.designMode) {
      // Allow submissions inside the theme editor without hitting the proxy.
      form.addEventListener("submit", (event) => event.preventDefault());
      return;
    }

    const statusNode = form.querySelector(".custom-enquiry__status");
    const submitButton = form.querySelector(".custom-enquiry__submit");
    const successMessage = form.dataset.successMessage || "Message received.";
    const errorMessage = form.dataset.errorMessage || "Something went wrong.";
    const endpoint = form.dataset.proxyUrl || form.action;

    if (!endpoint) {
      return;
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      if (!window.fetch) {
        return form.submit();
      }

      statusNode.textContent = "";
      submitButton.disabled = true;
      submitButton.classList.add("is-loading");

      const formData = new FormData(form);

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "X-Requested-With": "XMLHttpRequest",
          },
          body: formData,
          credentials: "same-origin",
        });

        const result = await response
          .json()
          .catch(() => ({ ok: response.ok }));

        if (response.ok && result?.ok) {
          statusNode.textContent = successMessage;
          statusNode.classList.remove("custom-enquiry__status--error");
          statusNode.classList.add("custom-enquiry__status--success");
          form.reset();
        } else {
          throw new Error("Request failed");
        }
      } catch (error) {
        console.error("Custom enquiry submission failed", error);
        statusNode.textContent = errorMessage;
        statusNode.classList.remove("custom-enquiry__status--success");
        statusNode.classList.add("custom-enquiry__status--error");
      } finally {
        submitButton.disabled = false;
        submitButton.classList.remove("is-loading");
      }
    });
  };

  const init = () => {
    document.querySelectorAll(".js-custom-request-form").forEach((form) => {
      initForm(form);
      const section = form.closest(".custom-enquiry");
      if (section) updateDynamicHeading(section, null);
      initProductContext(form);
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

