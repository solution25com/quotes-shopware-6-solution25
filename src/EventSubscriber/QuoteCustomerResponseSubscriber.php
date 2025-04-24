<?php

namespace S25Quotes\EventSubscriber;

use Shopware\Commercial\B2B\QuoteManagement\Event\QuoteStateMachineStateChangeEvent;
use Shopware\Core\Framework\Context;
use Shopware\Core\Framework\DataAbstractionLayer\EntityRepository;
use Shopware\Core\Framework\DataAbstractionLayer\Search\Criteria;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;
use Shopware\Commercial\CustomPricing\Domain\CustomPriceUpdater;

class QuoteCustomerResponseSubscriber implements EventSubscriberInterface
{

  private CustomPriceUpdater $customPriceUpdater;
  private EntityRepository $orderRepository;

  private EntityRepository $productRepository;

  public function __construct(
    CustomPriceUpdater $customPriceUpdater,
    EntityRepository   $orderRepository,
    EntityRepository   $productRepository,
  )
  {
    $this->customPriceUpdater = $customPriceUpdater;
    $this->orderRepository = $orderRepository;
    $this->productRepository = $productRepository;
  }

  public static function getSubscribedEvents()
  {
    return [
      "state_enter.quote.state.accepted" => 'quoteAccepted',
    ];
  }

  public function quoteAccepted(QuoteStateMachineStateChangeEvent $event): void
  {
    $quote = $event->getQuote();
    $lineItems = $quote->getLineItems();

    foreach ($lineItems as $lineItem) {

      $customFields = $lineItem->getCustomFields();
      if ($customFields && isset($customFields['persistPrice'])) {

        $productId = $lineItem->getProductId();
        $originalProduct = $this->getProductById($productId, $event->getContext());
        $originalPrice = $originalProduct->get('price')->getCurrencyPrice($event->getContext()->getCurrencyId());

        $calculatedPrice = $lineItem->getPrice();
        $totalPrice = $calculatedPrice->getTotalPrice();
        $taxRate = $calculatedPrice->getTaxRules()->first()->getTaxRate();
        $netPrice = $calculatedPrice->getTotalPrice() / (1 + ($taxRate / 100));

        if ($totalPrice != $originalPrice->getGross()) {
          $operations = [
            [
              "action" => "upsert",
              "payload" => [
                [
                  "productId" => $lineItem->getProductId(),
                  "customerId" => $event->getCustomerId(),
                  "price" => [
                    [
                      "quantityStart" => 1,
                      "quantityEnd" => null,
                      "price" => [
                        [
                          "currencyId" => $event->getContext()->getCurrencyId(),
                          "gross" => $totalPrice,
                          "net" => number_format($netPrice, 2),
                          "linked" => true
                        ]
                      ]
                    ]
                  ]
                ]
              ]
            ]
          ];
          $this->customPriceUpdater->sync($operations);
        }
      }
    }
  }

  private function getProductById(string $productId, Context $context)
  {
    $criteria = new Criteria([$productId]);
    return $this->productRepository->search($criteria, $context)->first();
  }

  private function getOrderDetailsById(string $orderId, Context $context)
  {
    $criteria = new Criteria([$orderId]);
    $criteria->addAssociation('lineItems');
    $criteria->addAssociation('lineItems.price');
    $criteria->addAssociation('transactions');
    $criteria->addAssociation('transactions.paymentMethod');
    $criteria->addAssociation('currency');
    return $this->orderRepository->search($criteria, $context)->first();
  }
}