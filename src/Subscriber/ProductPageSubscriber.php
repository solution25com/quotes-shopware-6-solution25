<?php

namespace S25Quotes\Subscriber;

use Shopware\Core\Content\Product\Events\ProductListingResultEvent;
use Shopware\Core\Content\Product\Events\ProductSearchResultEvent;
use Shopware\Core\Framework\Context;
use Shopware\Core\Framework\DataAbstractionLayer\EntityRepository;
use Shopware\Core\Framework\DataAbstractionLayer\Pricing\Price;
use Shopware\Core\Framework\DataAbstractionLayer\Pricing\PriceCollection;
use Shopware\Core\Framework\DataAbstractionLayer\Search\Criteria;
use Shopware\Core\Framework\Struct\ArrayStruct;
use Shopware\Storefront\Page\Product\ProductPageLoadedEvent;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;

class ProductPageSubscriber implements EventSubscriberInterface
{
  private EntityRepository $productRepository;

  public function __construct(EntityRepository $productRepository)
  {
    $this->productRepository = $productRepository;
  }

  public static function getSubscribedEvents(): array
  {
    return [
      ProductPageLoadedEvent::class => 'onProductPageLoaded',
      ProductListingResultEvent::class => 'onProductListingResult',
      ProductSearchResultEvent::class => 'onProductSearchResult',
    ];
  }

  public function onProductPageLoaded(ProductPageLoadedEvent $event): void
  {
    $product = $event->getPage()->getProduct();
    $this->addOriginalPrice($product, $event->getContext());

    $event->getPage()->addExtension('custom_extension_field', $product->getExtension('custom_extension_field'));
  }

  public function onProductListingResult(ProductListingResultEvent $event): void
  {
    $this->addOriginalPrices($event->getResult()->getEntities(), $event->getContext());
  }

  public function onProductSearchResult(ProductSearchResultEvent $event): void
  {
    $this->addOriginalPrices($event->getResult()->getEntities(), $event->getContext());
  }

  private function addOriginalPrice($product, Context $context): void
  {
    $productId = $product->getId();
    $productPrice = $this->getProductPrice($productId, $context);

    $customExtension = new ArrayStruct([
      'original_price' => $productPrice
    ]);

    $product->addExtension('custom_extension_field', $customExtension);
  }

  private function getProductPrice(string $productId, Context $context): float
  {
    $criteria = new Criteria([$productId]);
    $criteria->addAssociation('prices');

    $productData = $this->productRepository->search($criteria, $context)->first();

    /** @var PriceCollection|null $priceCollection */
    $priceCollection = $productData->getPrice();

    if (!$priceCollection instanceof PriceCollection) {
      throw new \RuntimeException('Price collection not found.');
    }

    /** @var Price|null $price */
    $price = $priceCollection->first();

    if (!$price instanceof Price) {
      throw new \RuntimeException('Price not found.');
    }

    return $price->getGross();
  }


  private function addOriginalPrices($products, Context $context): void
  {
    $productIds = [];
    foreach ($products as $product) {
      $productIds[] = $product->getId();
    }

    if (empty($productIds)) {
      return;
    }

    // Fetch all product prices in one query
    $prices = $this->getProductPrices($productIds, $context);

    // Apply the prices to products
    foreach ($products as $product) {
      $productId = $product->getId();
      $productPrice = $prices[$productId] ?? null;

      $customExtension = new ArrayStruct([
        'original_price' => $productPrice
      ]);

      $product->addExtension('custom_extension_field', $customExtension);
    }
  }

  private function getProductPrices(array $productIds, Context $context): array
  {
    $criteria = new Criteria($productIds);
    $criteria->addAssociation('prices');

    $products = $this->productRepository->search($criteria, $context)->getEntities();

    $prices = [];
    foreach ($products as $product) {
      /** @var PriceCollection|null $priceCollection */
      $priceCollection = $product->getPrice();

      if ($priceCollection instanceof PriceCollection) {
        /** @var Price|null $price */
        $price = $priceCollection->first();
        if ($price instanceof Price) {
          $prices[$product->getId()] = $price->getGross();
        }
      }
    }

    return $prices;
  }
}
